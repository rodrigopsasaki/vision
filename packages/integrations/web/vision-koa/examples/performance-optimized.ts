/**
 * Performance-Optimized Vision Koa Integration Example
 * 
 * This example demonstrates how to configure Vision for high-performance scenarios:
 * - Minimal overhead configuration
 * - Selective data capture
 * - Performance monitoring and alerting
 * - Memory usage tracking
 * - Async/await optimization patterns
 */

import Koa from 'koa';
import Router from '@koa/router';
import { createVisionMiddleware } from '@rodrigopsasaki/vision-koa';
import { vision } from '@rodrigopsasaki/vision';

const app = new Koa();
const router = new Router();

// Performance-optimized Vision configuration
app.use(createVisionMiddleware({
  // Minimal data capture for maximum performance
  captureHeaders: false,
  captureBody: false,
  captureQuery: false,
  captureParams: true, // Keep params for routing context
  captureKoaMetadata: false, // Skip Koa-specific metadata
  
  // Aggressive performance monitoring
  performance: {
    trackExecutionTime: true,
    slowOperationThreshold: 50, // Very aggressive threshold
    trackMemoryUsage: true
  },
  
  // Skip data redaction for performance (ensure no sensitive data first!)
  redactSensitiveData: false,
  
  // Simple, fast context naming
  contextNameGenerator: (ctx) => {
    return `${ctx.method}.${ctx.path}`;
  },
  
  // Minimal metadata extraction
  extractMetadata: (ctx) => {
    const metadata: Record<string, unknown> = {};
    
    // Only extract critical performance metrics
    const clientVersion = ctx.headers['x-client-version'];
    if (clientVersion) {
      metadata.client_version = clientVersion;
    }
    
    return metadata;
  },
  
  // Fast route exclusion
  shouldExcludeRoute: (ctx) => {
    const path = ctx.path;
    // Fast string comparisons
    return path.startsWith('/health') || 
           path.startsWith('/metrics') || 
           path.startsWith('/favicon');
  }
}));

// Ultra-fast route with minimal Vision overhead
router.get('/api/ultra-fast/:id', async (ctx) => {
  const { id } = ctx.params;
  
  // Minimal Vision usage for performance
  vision.set('operation', 'ultra_fast');
  
  // Fast lookup simulation
  const startTime = Date.now();
  const result = await ultraFastLookup(id);
  const duration = Date.now() - startTime;
  
  // Track performance
  vision.set('lookup_ms', duration);
  vision.set('cache_hit', result.cached);
  
  if (duration > 10) {
    vision.set('slow_lookup', true);
  }
  
  ctx.body = result.data;
});

// Streaming data processing
router.get('/api/stream/:count', async (ctx) => {
  const count = parseInt(ctx.params.count) || 1000;
  
  vision.set('operation', 'stream_processing');
  vision.set('item_count', count);
  
  const startTime = Date.now();
  const stream = createDataStream(count);
  
  let processed = 0;
  const results = [];
  
  // Process stream in chunks for better performance
  for await (const chunk of stream) {
    const processedChunk = processChunk(chunk);
    results.push(...processedChunk);
    processed += chunk.length;
    
    // Update progress periodically
    if (processed % 100 === 0) {
      vision.set(`processed_${processed}`, true);
    }
  }
  
  const totalTime = Date.now() - startTime;
  vision.set('total_time_ms', totalTime);
  vision.set('items_per_second', Math.round(count / (totalTime / 1000)));
  
  ctx.body = {
    processed: results.length,
    duration: totalTime,
    throughput: Math.round(count / (totalTime / 1000))
  };
});

// Bulk operations with batching
router.post('/api/bulk-process', async (ctx) => {
  const items = ctx.request.body as any[];
  
  vision.set('operation', 'bulk_process');
  vision.set('total_items', items.length);
  
  const startTime = Date.now();
  const batchSize = 50; // Optimal batch size for performance
  const results = [];
  
  // Process in parallel batches
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    batches.push(processBatchOptimized(batch, i / batchSize));
  }
  
  // Wait for all batches to complete
  const batchResults = await Promise.all(batches);
  results.push(...batchResults.flat());
  
  const totalTime = Date.now() - startTime;
  vision.set('processing_time_ms', totalTime);
  vision.set('batches_processed', batches.length);
  vision.set('throughput_items_per_sec', Math.round(items.length / (totalTime / 1000)));
  
  ctx.body = {
    processed: results.length,
    batches: batches.length,
    duration: totalTime,
    throughput: Math.round(items.length / (totalTime / 1000))
  };
});

// Memory-intensive operations with tracking
router.get('/api/memory-benchmark/:size', async (ctx) => {
  const size = parseInt(ctx.params.size) || 100000;
  
  vision.set('operation', 'memory_benchmark');
  vision.set('array_size', size);
  
  const memoryBefore = process.memoryUsage();
  vision.set('memory_before_mb', Math.round(memoryBefore.heapUsed / 1024 / 1024));
  
  // Create and process large data structure
  const startTime = Date.now();
  const largeData = createLargeDataStructure(size);
  const processed = processLargeData(largeData);
  const processingTime = Date.now() - startTime;
  
  const memoryAfter = process.memoryUsage();
  const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
  
  vision.set('processing_time_ms', processingTime);
  vision.set('memory_after_mb', Math.round(memoryAfter.heapUsed / 1024 / 1024));
  vision.set('memory_delta_mb', Math.round(memoryDelta / 1024 / 1024));
  vision.set('processed_items', processed.length);
  
  // Cleanup
  largeData.length = 0;
  processed.length = 0;
  
  // Force garbage collection if available
  if (global.gc) {
    const gcStartTime = Date.now();
    global.gc();
    const gcTime = Date.now() - gcStartTime;
    
    const memoryAfterGC = process.memoryUsage();
    vision.set('gc_time_ms', gcTime);
    vision.set('memory_after_gc_mb', Math.round(memoryAfterGC.heapUsed / 1024 / 1024));
  }
  
  ctx.body = {
    size,
    processingTime,
    memoryUsed: Math.round(memoryDelta / 1024 / 1024),
    processed: processed.length
  };
});

// CPU-intensive computation
router.get('/api/cpu-benchmark/:iterations', async (ctx) => {
  const iterations = parseInt(ctx.params.iterations) || 1000000;
  
  vision.set('operation', 'cpu_benchmark');
  vision.set('iterations', iterations);
  
  const startTime = process.hrtime.bigint();
  
  // CPU-heavy mathematical computation
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i) * Math.cos(i) * Math.tan(i / 100);
  }
  
  const endTime = process.hrtime.bigint();
  const durationNs = Number(endTime - startTime);
  const durationMs = durationNs / 1000000;
  
  vision.set('computation_time_ms', Math.round(durationMs));
  vision.set('operations_per_ms', Math.round(iterations / durationMs));
  
  if (durationMs > 100) {
    vision.set('cpu_intensive_operation', true);
  }
  
  ctx.body = {
    result: Math.round(result),
    iterations,
    duration: Math.round(durationMs),
    throughput: Math.round(iterations / durationMs)
  };
});

// Concurrent operations test
router.get('/api/concurrent-test/:concurrency', async (ctx) => {
  const concurrency = parseInt(ctx.params.concurrency) || 10;
  
  vision.set('operation', 'concurrent_test');
  vision.set('concurrency_level', concurrency);
  
  const startTime = Date.now();
  
  // Create concurrent operations
  const operations = Array.from({ length: concurrency }, (_, index) => 
    simulateConcurrentOperation(index)
  );
  
  // Wait for all operations to complete
  const results = await Promise.all(operations);
  
  const totalTime = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  
  vision.set('total_time_ms', totalTime);
  vision.set('successful_operations', successCount);
  vision.set('failed_operations', concurrency - successCount);
  vision.set('avg_time_per_operation', Math.round(totalTime / concurrency));
  
  ctx.body = {
    concurrency,
    successful: successCount,
    failed: concurrency - successCount,
    totalTime,
    averageTime: Math.round(totalTime / concurrency)
  };
});

// Performance monitoring endpoint
router.get('/api/performance/metrics', async (ctx) => {
  vision.set('operation', 'performance_metrics');
  
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const metrics = {
    timestamp: Date.now(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024)
    },
    cpu: {
      user: cpuUsage.user / 1000,
      system: cpuUsage.system / 1000
    },
    process: {
      uptime: process.uptime(),
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
  
  vision.set('memory_heap_used_mb', metrics.memory.heapUsed);
  vision.set('cpu_user_ms', metrics.cpu.user);
  vision.set('uptime_seconds', metrics.process.uptime);
  
  ctx.body = metrics;
});

// Health check with minimal overhead (excluded by default)
router.get('/health', async (ctx) => {
  ctx.body = {
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime()
  };
});

// Error handling with performance tracking
app.use(async (ctx, next) => {
  const start = Date.now();
  
  try {
    await next();
  } catch (err) {
    const errorTime = Date.now() - start;
    
    vision.set('error_occurred', true);
    vision.set('error_processing_time_ms', errorTime);
    vision.set('error_type', err.constructor.name);
    
    ctx.status = err.status || 500;
    ctx.body = {
      error: 'Internal Server Error',
      timestamp: Date.now()
    };
  }
});

// Register routes
app.use(router.routes());
app.use(router.allowedMethods());

// Performance helper functions
async function ultraFastLookup(id: string) {
  // Simulate extremely fast cache lookup
  const cached = Math.random() > 0.2; // 80% cache hit rate
  const delay = cached ? 2 : 15; // Cached responses are much faster
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  return {
    cached,
    data: {
      id,
      value: `fast_value_${id}`,
      timestamp: Date.now()
    }
  };
}

async function* createDataStream(count: number) {
  const chunkSize = 10;
  
  for (let i = 0; i < count; i += chunkSize) {
    const chunk = Array.from({ length: Math.min(chunkSize, count - i) }, (_, index) => ({
      id: i + index,
      data: `item_${i + index}`,
      timestamp: Date.now()
    }));
    
    // Small delay to simulate data generation
    await new Promise(resolve => setTimeout(resolve, 1));
    yield chunk;
  }
}

function processChunk(chunk: any[]) {
  return chunk.map(item => ({
    ...item,
    processed: true,
    checksum: item.id % 1000
  }));
}

async function processBatchOptimized(batch: any[], batchIndex: number) {
  // Optimize batch processing with minimal delay
  await new Promise(resolve => setTimeout(resolve, 5));
  
  return batch.map((item, index) => ({
    ...item,
    batchIndex,
    itemIndex: index,
    processed: true,
    timestamp: Date.now()
  }));
}

function createLargeDataStructure(size: number) {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    value: Math.random(),
    data: `item_${i}`,
    metadata: {
      created: Date.now(),
      type: i % 2 === 0 ? 'even' : 'odd'
    }
  }));
}

function processLargeData(data: any[]) {
  return data
    .filter(item => item.value > 0.5)
    .map(item => ({
      id: item.id,
      processedValue: item.value * 2,
      type: item.metadata.type
    }));
}

async function simulateConcurrentOperation(index: number) {
  const processingTime = Math.random() * 100 + 10; // 10-110ms
  const success = Math.random() > 0.1; // 90% success rate
  
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  return {
    index,
    success,
    processingTime: Math.round(processingTime),
    result: success ? `result_${index}` : null
  };
}

// Performance monitoring and alerting
let requestCount = 0;
let totalResponseTime = 0;

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const responseTime = Date.now() - start;
  
  requestCount++;
  totalResponseTime += responseTime;
  
  // Alert on slow requests
  if (responseTime > 100) {
    console.warn(`⚠️  Slow request: ${ctx.method} ${ctx.path} took ${responseTime}ms`);
  }
  
  // Log performance stats every 100 requests
  if (requestCount % 100 === 0) {
    const avgResponseTime = Math.round(totalResponseTime / requestCount);
    const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    
    console.log(`📊 Performance stats: ${requestCount} requests, avg ${avgResponseTime}ms, memory ${memoryMB}MB`);
    
    if (avgResponseTime > 50) {
      console.warn(`⚠️  High average response time: ${avgResponseTime}ms`);
    }
    
    if (memoryMB > 100) {
      console.warn(`⚠️  High memory usage: ${memoryMB}MB`);
    }
  }
});

// Memory monitoring
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  
  if (memoryMB > 150) {
    console.warn(`⚠️  Critical memory usage: ${memoryMB}MB`);
  }
}, 15000); // Check every 15 seconds

// Start the server
const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  console.log(`🚀 Performance-optimized Koa server with Vision is running on http://localhost:${PORT}`);
  console.log('');
  console.log('⚡ Performance test endpoints:');
  console.log('  GET /api/ultra-fast/123 - Ultra-fast lookup with caching');
  console.log('  GET /api/stream/1000 - Stream processing with 1000 items');
  console.log('  POST /api/bulk-process - Bulk processing (send JSON array)');
  console.log('  GET /api/memory-benchmark/100000 - Memory usage benchmark');
  console.log('  GET /api/cpu-benchmark/1000000 - CPU-intensive computation');
  console.log('  GET /api/concurrent-test/20 - Concurrent operations test');
  console.log('  GET /api/performance/metrics - System performance metrics');
  console.log('  GET /health - Health check (excluded from Vision)');
  console.log('');
  console.log('📊 Performance monitoring is active:');
  console.log('  - Request timing alerts (>100ms)');
  console.log('  - Memory usage monitoring (>150MB critical)');
  console.log('  - Average response time tracking');
  console.log('');
  console.log(`💾 Current memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log('');
  console.log('🔥 Run with --expose-gc flag to enable garbage collection tracking!');
});