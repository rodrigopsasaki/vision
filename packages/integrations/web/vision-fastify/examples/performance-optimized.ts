/**
 * Performance-Optimized Vision Fastify Integration Example
 *
 * This example demonstrates how to configure Vision for high-performance scenarios:
 * - Minimal overhead configuration
 * - Selective data capture
 * - Performance monitoring and alerting
 * - Memory usage tracking
 * - Custom performance variants
 */

import Fastify from "fastify";
import {
  createPerformanceVisionPlugin,
  createMinimalVisionPlugin,
  visionPlugin,
} from "@rodrigopsasaki/vision-fastify";
import { vision } from "@rodrigopsasaki/vision";

const fastify = Fastify({
  logger: false, // Disable default logging for performance
});

// Performance-optimized Vision configuration
await fastify.register(
  createPerformanceVisionPlugin({
    // Minimal data capture for maximum performance
    captureHeaders: false,
    captureBody: false,
    captureQuery: false,
    captureParams: true, // Keep params for routing context

    // Aggressive performance monitoring
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 50, // Very aggressive threshold
      trackMemoryUsage: true,
    },

    // Skip data redaction for performance (ensure no sensitive data first!)
    redactSensitiveData: false,

    // Custom context naming for performance
    contextNameGenerator: (request) => {
      // Simple, fast context naming
      return `${request.method}.${request.routeOptions?.url || "unknown"}`;
    },

    // Minimal metadata extraction
    extractMetadata: (request) => {
      // Only extract critical business metrics
      const metadata: Record<string, unknown> = {};

      // Fast header checks
      const clientVersion = request.headers["x-client-version"];
      if (clientVersion) {
        metadata.client_version = clientVersion;
      }

      return metadata;
    },

    // Fast route exclusion
    shouldExcludeRoute: (request) => {
      const url = request.url;
      // Fast string comparisons
      return url.startsWith("/health") || url.startsWith("/metrics") || url.startsWith("/favicon");
    },
  }),
);

// High-throughput API endpoint
fastify.get("/api/fast/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  // Minimal Vision usage for performance
  vision.set("operation", "fast_lookup");

  // Simulate fast database lookup
  const startTime = Date.now();
  const result = await fastLookup(id);
  const duration = Date.now() - startTime;

  // Track performance metrics
  vision.set("lookup_duration_ms", duration);
  vision.set("cache_hit", result.fromCache);

  if (duration > 25) {
    vision.set("slow_lookup", true);
  }

  return result.data;
});

// Bulk operations endpoint
fastify.post("/api/bulk", async (request, reply) => {
  const items = request.body as any[];

  vision.set("operation", "bulk_process");
  vision.set("batch_size", items.length);

  const startTime = Date.now();
  const results = [];

  // Process in batches for better performance
  const batchSize = 100;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processBatch(batch);
    results.push(...batchResults);

    // Track batch progress
    vision.set(`batch_${Math.floor(i / batchSize) + 1}_processed`, true);
  }

  const totalDuration = Date.now() - startTime;
  vision.set("total_duration_ms", totalDuration);
  vision.set("items_per_second", Math.round(items.length / (totalDuration / 1000)));

  return {
    processed: results.length,
    duration: totalDuration,
    throughput: Math.round(items.length / (totalDuration / 1000)),
  };
});

// Memory-intensive operation with tracking
fastify.get("/api/memory-test", async (request, reply) => {
  vision.set("operation", "memory_test");

  const memoryBefore = process.memoryUsage();
  vision.set("memory_before_mb", Math.round(memoryBefore.heapUsed / 1024 / 1024));

  // Simulate memory-intensive operation
  const largeArray = new Array(1000000).fill(0).map((_, i) => ({
    id: i,
    data: `item_${i}`,
    timestamp: Date.now(),
  }));

  // Process the data
  const processed = largeArray.filter((item) => item.id % 2 === 0);

  const memoryAfter = process.memoryUsage();
  const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;

  vision.set("memory_after_mb", Math.round(memoryAfter.heapUsed / 1024 / 1024));
  vision.set("memory_delta_mb", Math.round(memoryDelta / 1024 / 1024));
  vision.set("processed_count", processed.length);

  // Clean up
  largeArray.length = 0;
  processed.length = 0;

  // Force garbage collection if possible
  if (global.gc) {
    global.gc();
    const memoryAfterGC = process.memoryUsage();
    vision.set("memory_after_gc_mb", Math.round(memoryAfterGC.heapUsed / 1024 / 1024));
  }

  return {
    memoryUsed: Math.round(memoryDelta / 1024 / 1024),
    processed: processed.length,
  };
});

// CPU-intensive operation
fastify.get("/api/cpu-test/:iterations", async (request, reply) => {
  const { iterations } = request.params as { iterations: string };
  const count = parseInt(iterations, 10);

  vision.set("operation", "cpu_test");
  vision.set("iterations", count);

  const startTime = process.hrtime.bigint();

  // CPU-intensive calculation
  let result = 0;
  for (let i = 0; i < count; i++) {
    result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
  }

  const endTime = process.hrtime.bigint();
  const durationNs = Number(endTime - startTime);
  const durationMs = durationNs / 1000000;

  vision.set("cpu_duration_ms", Math.round(durationMs));
  vision.set("operations_per_ms", Math.round(count / durationMs));

  if (durationMs > 100) {
    vision.set("cpu_intensive", true);
  }

  return {
    result: Math.round(result),
    duration: Math.round(durationMs),
    throughput: Math.round(count / durationMs),
  };
});

// Performance monitoring endpoint
fastify.get("/api/performance/stats", async () => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  vision.set("operation", "performance_stats");

  return {
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    },
    cpu: {
      user: cpuUsage.user / 1000, // Convert to milliseconds
      system: cpuUsage.system / 1000,
    },
    uptime: process.uptime(),
    version: {
      node: process.version,
      v8: process.versions.v8,
    },
  };
});

// Minimal tracking endpoint for maximum throughput
fastify.register(
  createMinimalVisionPlugin({
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 10, // Very fast threshold
      trackMemoryUsage: false, // Skip memory tracking for max speed
    },
  }),
  { prefix: "/minimal" },
);

fastify.get("/minimal/ultra-fast", async () => {
  // This endpoint has minimal Vision overhead
  vision.set("ultra_fast", true);

  return {
    message: "Ultra fast response",
    timestamp: Date.now(),
  };
});

// Mock functions for demonstration
async function fastLookup(id: string) {
  // Simulate cache lookup
  const fromCache = Math.random() > 0.3; // 70% cache hit rate
  const delay = fromCache ? 5 : 25; // Cache hits are much faster

  await new Promise((resolve) => setTimeout(resolve, delay));

  return {
    fromCache,
    data: {
      id,
      name: `Item ${id}`,
      cached: fromCache,
      timestamp: Date.now(),
    },
  };
}

async function processBatch(items: any[]) {
  // Simulate batch processing
  await new Promise((resolve) => setTimeout(resolve, 10));

  return items.map((item) => ({
    ...item,
    processed: true,
    timestamp: Date.now(),
  }));
}

// Global error handler for performance tracking
fastify.setErrorHandler(async (error, request, reply) => {
  vision.set("error_occurred", true);
  vision.set("error_type", error.constructor.name);

  // Log error without sensitive data
  console.error("Request error:", {
    method: request.method,
    url: request.url,
    error: error.message,
  });

  return reply.status(500).send({
    error: "Internal Server Error",
    timestamp: Date.now(),
  });
});

// Performance monitoring and alerting
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

  if (memoryMB > 100) {
    // Alert if memory usage > 100MB
    console.warn(`⚠️  High memory usage: ${memoryMB}MB`);
  }
}, 10000); // Check every 10 seconds

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: "0.0.0.0" });
    console.log(
      "🚀 Performance-optimized Fastify server with Vision is running on http://localhost:3002",
    );
    console.log("");
    console.log("⚡ Performance test endpoints:");
    console.log("  GET /api/fast/123 - Fast lookup with caching");
    console.log("  POST /api/bulk - Bulk processing (send JSON array)");
    console.log("  GET /api/memory-test - Memory usage tracking");
    console.log("  GET /api/cpu-test/1000000 - CPU-intensive operation");
    console.log("  GET /api/performance/stats - System performance stats");
    console.log("");
    console.log("🏃 Ultra-fast endpoints (minimal Vision overhead):");
    console.log("  GET /minimal/ultra-fast - Minimal tracking for max throughput");
    console.log("");
    console.log("📊 Watch for performance alerts and slow operation warnings!");
    console.log(
      `💾 Current memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    );
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

start();
