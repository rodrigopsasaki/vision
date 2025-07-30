import { PrismaClient } from "@prisma/client";
import { vision } from "@rodrigopsasaki/vision";
import { instrumentPrisma } from "../src";
import express from "express";
import { visionMiddleware } from "@rodrigopsasaki/vision-express";

// Microservice configuration
const SERVICE_NAME = process.env.SERVICE_NAME || "user-service";
const SERVICE_VERSION = process.env.SERVICE_VERSION || "1.0.0";
const SERVICE_INSTANCE = process.env.HOSTNAME || `instance-${Math.random().toString(36).substr(2, 9)}`;

// Initialize Vision with microservice context
vision.init({
  exporters: [
    {
      name: "microservice-exporter",
      before: (ctx) => {
        // Add service metadata to every context
        ctx.data.set("service.name", SERVICE_NAME);
        ctx.data.set("service.version", SERVICE_VERSION);
        ctx.data.set("service.instance", SERVICE_INSTANCE);
      },
      success: (ctx) => {
        const duration = Date.now() - new Date(ctx.timestamp).getTime();
        const data = Object.fromEntries(ctx.data);
        
        // Structured logs for log aggregation (e.g., ELK stack)
        console.log(JSON.stringify({
          timestamp: ctx.timestamp,
          level: "info",
          service: SERVICE_NAME,
          instance: SERVICE_INSTANCE,
          traceId: ctx.id,
          operation: ctx.name,
          duration,
          data,
        }));
      },
      error: (ctx, err) => {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: SERVICE_NAME,
          instance: SERVICE_INSTANCE,
          traceId: ctx.id,
          operation: ctx.name,
          error: {
            message: err.message,
            stack: err.stack,
          },
          data: Object.fromEntries(ctx.data),
        }));
      },
    },
    {
      name: "metrics-exporter",
      success: (ctx) => {
        // In production, send to Prometheus, DataDog, etc.
        const data = Object.fromEntries(ctx.data);
        if (data["database.operation"]) {
          console.log(`METRIC: ${SERVICE_NAME}.database.operation.duration ${data["database.duration_ms"]}ms operation="${data["database.operation"]}"`);
        }
      },
    },
  ],
});

// Instrument Prisma for this microservice
const prisma = instrumentPrisma(new PrismaClient(), {
  operationPrefix: `${SERVICE_NAME}.db`,
  includeModelInName: true,
  logResultCount: true,
});

// Express app with distributed tracing support
const app = express();
app.use(express.json());

// Vision middleware with trace propagation
app.use((req, res, next) => {
  // Extract trace context from headers (e.g., from API Gateway)
  const traceId = req.headers["x-trace-id"] as string;
  const parentSpanId = req.headers["x-parent-span-id"] as string;
  const userId = req.headers["x-user-id"] as string;
  
  // Store in request for later use
  (req as any).traceContext = {
    traceId,
    parentSpanId,
    userId,
  };
  
  next();
});

// Vision middleware with custom configuration
app.use(visionMiddleware({
  nameResolver: (req) => `${SERVICE_NAME}.${req.method.toLowerCase()}.${req.path}`,
  correlationIdHeaders: ["x-trace-id", "x-request-id", "x-correlation-id"],
  extractUser: (req) => (req as any).traceContext?.userId,
}));

// Health check endpoint for container orchestration
app.get("/health", async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      instance: SERVICE_INSTANCE,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      service: SERVICE_NAME,
      error: "Database connection failed",
    });
  }
});

// Service endpoints
app.get("/users/:id", async (req, res) => {
  const traceContext = (req as any).traceContext;
  
  vision.set("trace.id", traceContext?.traceId);
  vision.set("trace.parent_span_id", traceContext?.parentSpanId);
  vision.set("user.id", req.params.id);
  
  try {
    // Simulate inter-service communication
    vision.push("events", "fetching_user_data");
    
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        profile: true,
        _count: {
          select: {
            posts: true,
            comments: true,
          },
        },
      },
    });
    
    if (!user) {
      vision.set("user.found", false);
      return res.status(404).json({
        error: "User not found",
        service: SERVICE_NAME,
      });
    }
    
    vision.set("user.found", true);
    vision.set("user.email", user.email);
    vision.set("user.post_count", user._count.posts);
    vision.set("user.comment_count", user._count.comments);
    
    // Simulate calling another microservice
    vision.push("events", "enriching_user_data");
    const enrichedData = await enrichUserData(user, traceContext);
    
    res.json({
      ...user,
      ...enrichedData,
      _metadata: {
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        traceId: traceContext?.traceId,
      },
    });
  } catch (error) {
    vision.set("error.type", "user_fetch_error");
    throw error;
  }
});

app.post("/users", async (req, res) => {
  const traceContext = (req as any).traceContext;
  
  vision.set("trace.id", traceContext?.traceId);
  vision.set("operation.type", "user_creation");
  
  try {
    // Validate in this service
    const { email, name } = req.body;
    if (!email || !name) {
      vision.set("error.type", "validation_error");
      return res.status(400).json({
        error: "Email and name are required",
        service: SERVICE_NAME,
      });
    }
    
    // Create user with distributed transaction pattern
    const user = await vision.observe("distributed.create_user", async () => {
      vision.set("transaction.type", "saga");
      vision.push("events", "user_creation_started");
      
      // Step 1: Create user in database
      const newUser = await prisma.user.create({
        data: {
          email,
          name,
          profile: {
            create: {
              bio: `New user created by ${SERVICE_NAME}`,
            },
          },
        },
        include: {
          profile: true,
        },
      });
      
      vision.set("user.id", newUser.id);
      vision.push("events", "user_created_in_db");
      
      try {
        // Step 2: Notify other services (simulated)
        await notifyUserCreation(newUser, traceContext);
        vision.push("events", "notifications_sent");
        
        // Step 3: Initialize user preferences (simulated)
        await initializeUserPreferences(newUser.id, traceContext);
        vision.push("events", "preferences_initialized");
        
        return newUser;
      } catch (error) {
        // Compensating transaction
        vision.push("events", "rollback_initiated");
        await prisma.user.delete({ where: { id: newUser.id } });
        vision.push("events", "rollback_completed");
        throw error;
      }
    });
    
    res.status(201).json({
      ...user,
      _metadata: {
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        traceId: traceContext?.traceId,
        createdBy: SERVICE_INSTANCE,
      },
    });
  } catch (error) {
    vision.set("error.type", "user_creation_failed");
    throw error;
  }
});

// Batch endpoint for bulk operations
app.post("/users/batch", async (req, res) => {
  const traceContext = (req as any).traceContext;
  
  vision.set("trace.id", traceContext?.traceId);
  vision.set("operation.type", "batch_user_operation");
  vision.set("batch.size", req.body.users?.length || 0);
  
  try {
    const { users, operation } = req.body;
    
    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: "Users array required" });
    }
    
    let result;
    
    switch (operation) {
      case "create":
        result = await prisma.user.createMany({
          data: users,
          skipDuplicates: true,
        });
        vision.set("batch.created", result.count);
        break;
        
      case "update":
        // Update in batches to avoid long transactions
        const updateResults = [];
        for (const batch of chunkArray(users, 100)) {
          const batchResult = await Promise.all(
            batch.map(user => 
              prisma.user.update({
                where: { id: user.id },
                data: user.data,
              })
            )
          );
          updateResults.push(...batchResult);
        }
        result = { count: updateResults.length };
        vision.set("batch.updated", result.count);
        break;
        
      default:
        return res.status(400).json({ error: "Invalid operation" });
    }
    
    res.json({
      result,
      _metadata: {
        service: SERVICE_NAME,
        traceId: traceContext?.traceId,
        batchSize: users.length,
        operation,
      },
    });
  } catch (error) {
    vision.set("error.type", "batch_operation_failed");
    throw error;
  }
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  const traceContext = req.traceContext;
  
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    service: SERVICE_NAME,
    traceId: traceContext?.traceId,
    error: {
      message: err.message,
      stack: err.stack,
    },
  }));
  
  res.status(500).json({
    error: "Internal server error",
    service: SERVICE_NAME,
    traceId: traceContext?.traceId,
  });
});

// Helper functions
async function enrichUserData(user: any, traceContext: any) {
  // Simulate calling another microservice
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return {
    preferences: {
      theme: "light",
      language: "en",
      notifications: true,
    },
    lastActivity: new Date().toISOString(),
  };
}

async function notifyUserCreation(user: any, traceContext: any) {
  // Simulate async notification
  await new Promise(resolve => setTimeout(resolve, 100));
  vision.set("notification.sent", true);
}

async function initializeUserPreferences(userId: number, traceContext: any) {
  // Simulate preference initialization
  await new Promise(resolve => setTimeout(resolve, 50));
  vision.set("preferences.initialized", true);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Graceful shutdown for container orchestration
let server: any;

async function shutdown() {
  console.log(`${SERVICE_NAME}: Shutting down gracefully...`);
  
  if (server) {
    server.close();
  }
  
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the microservice
const PORT = process.env.PORT || 3001;

async function startMicroservice() {
  console.log(`🚀 ${SERVICE_NAME} v${SERVICE_VERSION}`);
  console.log(`📊 Vision Prisma Microservice Example`);
  console.log(`🆔 Instance: ${SERVICE_INSTANCE}\n`);
  
  // Run migrations in production
  if (process.env.NODE_ENV === "production") {
    console.log("Running database migrations...");
    // In production: await prisma.$migrate.deploy();
  }
  
  server = app.listen(PORT, () => {
    console.log(`✅ Service listening on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log("\nEndpoints:");
    console.log(`  GET  /users/:id      - Get user by ID`);
    console.log(`  POST /users          - Create new user`);
    console.log(`  POST /users/batch    - Batch operations`);
    console.log("\nDistributed tracing headers:");
    console.log("  X-Trace-ID: <trace-id>");
    console.log("  X-Parent-Span-ID: <parent-span>");
    console.log("  X-User-ID: <user-id>");
    console.log("\nPress Ctrl+C to stop\n");
  });
}

startMicroservice().catch((error) => {
  console.error(`Failed to start ${SERVICE_NAME}:`, error);
  process.exit(1);
});