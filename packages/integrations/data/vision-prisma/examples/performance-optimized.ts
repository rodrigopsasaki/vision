import { PrismaClient } from "@prisma/client";
import { vision } from "@rodrigopsasaki/vision";
import { instrumentPrisma, type VisionPrismaConfig } from "../src";

// Performance-optimized configuration
const performanceConfig: VisionPrismaConfig = {
  enabled: true,

  // Disable expensive logging in production
  logParams: false, // Don't log params for security and performance
  logQuery: false, // Don't log full queries to reduce overhead

  // Keep essential metrics
  logResultCount: true,
  includeModelInName: true,
  operationPrefix: "db",

  // Minimal redaction for performance
  redactFields: ["password", "token"],

  // Disable connection info logging
  logConnectionInfo: false,
};

// Create optimized Prisma client
const prisma = instrumentPrisma(
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }),
  performanceConfig,
);

// Initialize Vision with batched exporter for performance
const batchedMetrics: any[] = [];
let batchTimer: NodeJS.Timeout | null = null;

vision.init({
  exporters: [
    {
      name: "batched-metrics",
      success: (ctx) => {
        // Batch metrics to reduce overhead
        const metrics = {
          timestamp: ctx.timestamp,
          name: ctx.name,
          duration: Date.now() - new Date(ctx.timestamp).getTime(),
          database: extractDatabaseMetrics(ctx.data),
        };

        batchedMetrics.push(metrics);

        // Send batch every 5 seconds or when buffer is full
        if (batchedMetrics.length >= 100) {
          flushMetrics();
        } else if (!batchTimer) {
          batchTimer = setTimeout(flushMetrics, 5000);
        }
      },
      error: (ctx, err) => {
        // Send errors immediately
        console.error("Operation error:", err);
        sendErrorMetric(ctx, err);
      },
    },
  ],
});

function extractDatabaseMetrics(data: Map<string, unknown>) {
  const metrics: any = {};
  data.forEach((value, key) => {
    if (key.startsWith("database.")) {
      metrics[key.replace("database.", "")] = value;
    }
  });
  return metrics;
}

function flushMetrics() {
  if (batchedMetrics.length === 0) return;

  // In production, send to your metrics service
  console.log(`📊 Flushing ${batchedMetrics.length} metrics`);

  // Group by operation for summary
  const summary = batchedMetrics.reduce(
    (acc, metric) => {
      const op = metric.database.operation || "unknown";
      if (!acc[op]) {
        acc[op] = { count: 0, totalDuration: 0, avgDuration: 0 };
      }
      acc[op].count++;
      acc[op].totalDuration += metric.database.duration_ms || 0;
      return acc;
    },
    {} as Record<string, any>,
  );

  // Calculate averages
  Object.keys(summary).forEach((op) => {
    summary[op].avgDuration = Math.round(summary[op].totalDuration / summary[op].count);
  });

  console.log("Summary:", summary);

  // Clear batch
  batchedMetrics.length = 0;
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
}

function sendErrorMetric(ctx: any, err: any) {
  // In production, send to error tracking service
  console.error("Error metric:", {
    id: ctx.id,
    name: ctx.name,
    error: err.message,
  });
}

// Performance best practices demonstrations
async function performanceExamples() {
  console.log("🚀 Vision Prisma Performance-Optimized Example");
  console.log("📊 Demonstrating best practices for production use\n");

  // Best Practice 1: Use select to minimize data transfer
  await vision.observe("perf.selective-query", async () => {
    console.log("1. Using select for minimal data transfer...");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        _count: {
          select: {
            posts: true,
          },
        },
      },
      take: 100, // Always limit results
    });

    vision.set("optimization", "selective_fields");
    vision.set("fields_selected", 3);
    console.log(`   ✓ Selected only necessary fields for ${users.length} users\n`);
  });

  // Best Practice 2: Use findFirst instead of findMany when you need one
  await vision.observe("perf.find-first", async () => {
    console.log("2. Using findFirst for single record...");

    const user = await prisma.user.findFirst({
      where: {
        email: { contains: "@example.com" },
      },
      orderBy: { createdAt: "desc" },
    });

    vision.set("optimization", "find_first");
    vision.set("found", !!user);
    console.log("   ✓ Used findFirst instead of findMany + [0]\n");
  });

  // Best Practice 3: Batch operations with createMany
  await vision.observe("perf.batch-create", async () => {
    console.log("3. Batch creating records...");

    const userData = Array.from({ length: 10 }, (_, i) => ({
      email: `perf-user-${i}-${Date.now()}@example.com`,
      name: `Performance User ${i}`,
    }));

    const result = await prisma.user.createMany({
      data: userData,
      skipDuplicates: true,
    });

    vision.set("optimization", "batch_create");
    vision.set("records_created", result.count);
    console.log(`   ✓ Created ${result.count} users in one query\n`);
  });

  // Best Practice 4: Use cursor-based pagination for large datasets
  await vision.observe("perf.cursor-pagination", async () => {
    console.log("4. Using cursor-based pagination...");

    const pageSize = 20;
    let cursor: number | undefined;
    let totalFetched = 0;

    // Fetch first page
    const firstPage = await prisma.user.findMany({
      take: pageSize,
      orderBy: { id: "asc" },
    });

    if (firstPage.length > 0) {
      cursor = firstPage[firstPage.length - 1].id;
      totalFetched = firstPage.length;

      // Fetch second page
      const secondPage = await prisma.user.findMany({
        take: pageSize,
        skip: 1, // Skip the cursor record
        cursor: { id: cursor },
        orderBy: { id: "asc" },
      });

      totalFetched += secondPage.length;
    }

    vision.set("optimization", "cursor_pagination");
    vision.set("total_fetched", totalFetched);
    console.log(`   ✓ Fetched ${totalFetched} records using cursor pagination\n`);
  });

  // Best Practice 5: Use raw queries for complex aggregations
  await vision.observe("perf.raw-aggregation", async () => {
    console.log("5. Using raw query for complex aggregation...");

    const stats = await prisma.$queryRaw<
      Array<{ day: Date; user_count: bigint; post_count: bigint }>
    >`
      SELECT 
        DATE(u.created_at) as day,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT p.id) as post_count
      FROM "User" u
      LEFT JOIN "Post" p ON p."authorId" = u.id
      WHERE u.created_at > CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(u.created_at)
      ORDER BY day DESC
    `;

    vision.set("optimization", "raw_query_aggregation");
    vision.set("days_analyzed", stats.length);
    console.log(`   ✓ Aggregated ${stats.length} days of data efficiently\n`);
  });

  // Best Practice 6: Use transactions wisely
  await vision.observe("perf.optimized-transaction", async () => {
    console.log("6. Using optimized transaction...");

    // Use interactive transactions only when necessary
    const result = await prisma.$transaction(
      async (tx) => {
        // Check condition first
        const existingUser = await tx.user.findFirst({
          where: { email: "transaction@example.com" },
          select: { id: true }, // Minimal select
        });

        if (existingUser) {
          vision.set("transaction_skipped", true);
          return existingUser;
        }

        // Only create if doesn't exist
        return await tx.user.create({
          data: {
            email: "transaction@example.com",
            name: "Transaction User",
          },
          select: { id: true, email: true }, // Minimal select
        });
      },
      {
        maxWait: 5000, // 5 seconds
        timeout: 10000, // 10 seconds
        isolationLevel: "ReadCommitted", // Use appropriate isolation
      },
    );

    vision.set("optimization", "conditional_transaction");
    console.log("   ✓ Used transaction with conditions and timeouts\n");
  });

  // Best Practice 7: Connection pooling configuration
  console.log("7. Connection pooling best practices:");
  console.log("   - Set connection_limit based on your database");
  console.log("   - Use pgbouncer for PostgreSQL in production");
  console.log("   - Monitor connection pool metrics");
  console.log("   ✓ Configure in DATABASE_URL: ?connection_limit=10\n");

  // Best Practice 8: Use indexes effectively
  await vision.observe("perf.indexed-query", async () => {
    console.log("8. Querying with indexed fields...");

    // Query using indexed fields
    const posts = await prisma.post.findMany({
      where: {
        published: true, // Indexed
        authorId: 1, // Indexed
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" }, // Use indexed sort
      take: 50,
    });

    vision.set("optimization", "indexed_query");
    vision.set("used_indexes", ["published", "authorId"]);
    console.log(`   ✓ Query used indexed fields for ${posts.length} posts\n`);
  });

  // Flush any remaining metrics
  flushMetrics();
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  flushMetrics();
  await prisma.$disconnect();
  process.exit(0);
});

// Run examples
performanceExamples()
  .catch((error) => {
    console.error("Example failed:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n✨ Performance examples completed!");
    console.log("💡 Key takeaways:");
    console.log("   - Disable expensive logging in production");
    console.log("   - Use select to minimize data transfer");
    console.log("   - Batch operations when possible");
    console.log("   - Use cursor pagination for large datasets");
    console.log("   - Configure connection pooling properly");
    console.log("   - Design indexes for your query patterns");
    process.exit(0);
  });
