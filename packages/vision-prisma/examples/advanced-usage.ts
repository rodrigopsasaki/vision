import { PrismaClient } from "@prisma/client";
import { vision } from "@rodrigopsasaki/vision";
import { instrumentPrismaWithQueryLogging, type VisionPrismaConfig } from "../src";
import express from "express";
import { visionMiddleware } from "@rodrigopsasaki/vision-express";

// Initialize Vision with multiple exporters
vision.init({
  exporters: [
    {
      name: "console-pretty",
      success: (ctx) => {
        const duration = Date.now() - new Date(ctx.timestamp).getTime();
        const data = Object.fromEntries(ctx.data);
        
        console.log(`✅ [${ctx.id}] ${ctx.name}`);
        console.log(`   Duration: ${duration}ms`);
        
        // Pretty print database operations
        if (data["database.operation"]) {
          console.log(`   Database Operation: ${data["database.operation"]}`);
          console.log(`   Success: ${data["database.success"]}`);
          console.log(`   Duration: ${data["database.duration_ms"]}ms`);
          
          if (data["database.result_count"] !== undefined) {
            console.log(`   Result Count: ${data["database.result_count"]}`);
          }
          
          if (data["database.query"]) {
            console.log(`   Query: ${data["database.query"]}`);
          }
        }
        
        // Print custom data
        const customKeys = Object.keys(data).filter(k => !k.startsWith("database."));
        if (customKeys.length > 0) {
          console.log("   Custom Data:");
          customKeys.forEach(key => {
            console.log(`     ${key}: ${JSON.stringify(data[key])}`);
          });
        }
        
        console.log("");
      },
      error: (ctx, err) => {
        console.error(`❌ [${ctx.id}] ${ctx.name} failed:`, err);
        console.error("   Context:", Object.fromEntries(ctx.data));
        console.log("");
      },
    },
    {
      name: "metrics",
      success: (ctx) => {
        // In a real app, you'd send these to your metrics service
        const data = Object.fromEntries(ctx.data);
        if (data["database.operation"]) {
          console.log(`📊 Metrics: ${data["database.operation"]} - ${data["database.duration_ms"]}ms`);
        }
      },
    },
  ],
});

// Advanced Prisma configuration
const prismaConfig: VisionPrismaConfig = {
  // Enable all features for this example
  enabled: true,
  logParams: true, // Be careful in production!
  logQuery: true,
  logResultCount: true,
  maxQueryLength: 500,
  includeModelInName: true,
  operationPrefix: "database",
  redactFields: ["password", "token", "secret", "apiKey", "creditCard"],
  logConnectionInfo: true,
};

// Create and instrument Prisma with query logging
const prisma = instrumentPrismaWithQueryLogging(new PrismaClient({
  log: ["query"], // Enable Prisma query events
}), prismaConfig);

// Create Express app with Vision middleware
const app = express();
app.use(express.json());
app.use(visionMiddleware({
  captureBody: true,
  excludeRoutes: ["/health"],
}));

// API Routes that demonstrate Vision + Prisma integration
app.get("/api/users", async (req, res) => {
  vision.set("endpoint", "/api/users");
  vision.set("query_params", req.query);
  
  try {
    // Apply filters from query params
    const where: any = {};
    if (req.query.email) {
      where.email = { contains: req.query.email as string };
    }
    if (req.query.name) {
      where.name = { contains: req.query.name as string };
    }
    
    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    vision.set("pagination", { page, limit, skip });
    
    // Execute queries - Vision tracks everything!
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          posts: {
            select: {
              id: true,
              title: true,
              published: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);
    
    vision.set("total_records", total);
    vision.set("returned_records", users.length);
    vision.set("total_pages", Math.ceil(total / limit));
    
    res.json({
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    vision.set("error_type", "database_query_error");
    throw error;
  }
});

app.post("/api/users", async (req, res) => {
  vision.set("endpoint", "/api/users");
  vision.set("operation_type", "create");
  
  try {
    // Validate input
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      vision.set("error_type", "validation_error");
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existing) {
      vision.set("error_type", "duplicate_user");
      vision.set("duplicate_email", email);
      return res.status(409).json({ error: "User already exists" });
    }
    
    // Create user with transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          // In real app, you'd hash the password!
          profile: {
            create: {
              bio: `${name} just joined!`,
            },
          },
        },
        include: {
          profile: true,
        },
      });
      
      // Create welcome post
      const post = await tx.post.create({
        data: {
          title: `Welcome ${name}!`,
          content: "This is your first post",
          published: true,
          authorId: user.id,
        },
      });
      
      vision.set("transaction_operations", ["user.create", "post.create"]);
      
      return { user, post };
    });
    
    vision.set("created_user_id", result.user.id);
    vision.set("created_post_id", result.post.id);
    
    res.status(201).json(result.user);
  } catch (error) {
    vision.set("error_type", "transaction_error");
    throw error;
  }
});

app.get("/api/users/:id/posts", async (req, res) => {
  vision.set("endpoint", "/api/users/:id/posts");
  vision.set("user_id", req.params.id);
  
  try {
    const userId = parseInt(req.params.id);
    
    // First check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      vision.set("user_found", false);
      return res.status(404).json({ error: "User not found" });
    }
    
    vision.set("user_found", true);
    vision.set("user_email", user.email);
    
    // Get posts with pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
        published: req.query.published === "false" ? false : true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });
    
    vision.set("posts_returned", posts.length);
    vision.set("include_unpublished", req.query.published === "false");
    
    res.json({
      data: posts,
      meta: {
        userId,
        page,
        limit,
      },
    });
  } catch (error) {
    vision.set("error_type", "query_error");
    throw error;
  }
});

app.post("/api/posts/:id/like", async (req, res) => {
  vision.set("endpoint", "/api/posts/:id/like");
  vision.set("post_id", req.params.id);
  
  try {
    const postId = parseInt(req.params.id);
    const userId = req.body.userId; // In real app, get from auth
    
    if (!userId) {
      vision.set("error_type", "missing_user_id");
      return res.status(400).json({ error: "User ID required" });
    }
    
    // Use upsert to handle duplicate likes gracefully
    const like = await prisma.like.upsert({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
      update: {
        createdAt: new Date(), // Update timestamp
      },
      create: {
        userId,
        postId,
      },
    });
    
    // Get updated like count
    const likeCount = await prisma.like.count({
      where: { postId },
    });
    
    vision.set("like_id", like.id);
    vision.set("total_likes", likeCount);
    vision.set("is_new_like", like.createdAt.getTime() === like.updatedAt.getTime());
    
    res.json({
      liked: true,
      totalLikes: likeCount,
    });
  } catch (error) {
    vision.set("error_type", "like_error");
    throw error;
  }
});

// Aggregation example
app.get("/api/stats", async (req, res) => {
  vision.set("endpoint", "/api/stats");
  
  try {
    // Multiple aggregations in parallel
    const [userStats, postStats, recentActivity] = await Promise.all([
      // User statistics
      prisma.user.aggregate({
        _count: { _all: true },
        _max: { createdAt: true },
        _min: { createdAt: true },
      }),
      
      // Post statistics with grouping
      prisma.post.groupBy({
        by: ["published"],
        _count: { _all: true },
      }),
      
      // Recent activity
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          'user' as type
        FROM "User"
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        UNION ALL
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          'post' as type
        FROM "Post"
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
    ]);
    
    vision.set("aggregation_queries", 3);
    vision.set("total_users", userStats._count._all);
    vision.set("post_stats", postStats);
    
    res.json({
      users: {
        total: userStats._count._all,
        firstUserDate: userStats._min.createdAt,
        lastUserDate: userStats._max.createdAt,
      },
      posts: {
        byStatus: postStats,
      },
      recentActivity,
    });
  } catch (error) {
    vision.set("error_type", "aggregation_error");
    throw error;
  }
});

// Health check endpoint (excluded from Vision tracking)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  vision.set("error_message", err.message);
  vision.set("error_stack", err.stack);
  
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Demonstration function
async function runAdvancedExamples() {
  console.log("🚀 Vision Prisma Advanced Example");
  console.log("📊 Demonstrating full integration with Express and complex queries\n");
  
  // Seed some data
  await vision.observe("seed.database", async () => {
    console.log("Seeding database...");
    
    // Clean up first
    await prisma.like.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    
    // Create users with profiles
    const users = await Promise.all([
      prisma.user.create({
        data: {
          email: "alice@example.com",
          name: "Alice",
          profile: {
            create: { bio: "Software engineer" },
          },
          posts: {
            create: [
              { title: "Hello World", content: "My first post", published: true },
              { title: "Draft Post", content: "Work in progress", published: false },
            ],
          },
        },
      }),
      prisma.user.create({
        data: {
          email: "bob@example.com",
          name: "Bob",
          profile: {
            create: { bio: "Data scientist" },
          },
          posts: {
            create: [
              { title: "Data Analysis Tips", content: "Some tips...", published: true },
            ],
          },
        },
      }),
    ]);
    
    vision.set("seeded_users", users.length);
    console.log(`Seeded ${users.length} users with posts\n`);
  });
  
  // Start the server
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log("📊 Vision is tracking both HTTP requests and database operations");
    console.log("\nTry these endpoints:");
    console.log(`  GET  http://localhost:${PORT}/api/users`);
    console.log(`  GET  http://localhost:${PORT}/api/users?email=alice`);
    console.log(`  POST http://localhost:${PORT}/api/users`);
    console.log(`  GET  http://localhost:${PORT}/api/users/1/posts`);
    console.log(`  POST http://localhost:${PORT}/api/posts/1/like`);
    console.log(`  GET  http://localhost:${PORT}/api/stats`);
    console.log("\nPress Ctrl+C to stop\n");
  });
  
  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n\nShutting down gracefully...");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Run the example
runAdvancedExamples().catch((error) => {
  console.error("Example failed:", error);
  process.exit(1);
});