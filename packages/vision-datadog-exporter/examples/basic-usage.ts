#!/usr/bin/env tsx

/**
 * Basic usage example for @rodrigopsasaki/datadog-exporter
 * 
 * This example demonstrates how to use the Datadog exporter
 * to send metrics, logs, traces, and events to Datadog.
 * 
 * To run this example:
 * 1. Set your Datadog API key: export DATADOG_API_KEY=your-api-key
 * 2. Run: npx tsx examples/basic-usage.ts
 */

import { DatadogExporter } from '../src/datadog-exporter.js';

async function main() {
  console.log('🚀 Starting Datadog Exporter Example...\n');

  // Create exporter instance
  const exporter = new DatadogExporter({
    apiKey: process.env.DATADOG_API_KEY || 'demo-api-key',
    service: 'example-service',
    env: 'development',
    hostname: 'example-host',
    tags: ['env:development', 'service:example-service'],
    timeout: 5000,
    retries: 2,
    batchSize: 10,
    flushInterval: 2000,
  });

  try {
    const timestamp = Date.now() / 1000;

    console.log('📊 Exporting metrics...');
    
    // Export some metrics
    await exporter.exportMetrics([
      {
        metric: 'example.request.count',
        points: [[timestamp, 1]],
        tags: ['endpoint:/api/example', 'method:GET'],
        type: 'count',
      },
      {
        metric: 'example.request.duration',
        points: [[timestamp, 125.5]],
        tags: ['endpoint:/api/example', 'method:GET'],
        type: 'histogram',
      },
      {
        metric: 'example.memory.usage',
        points: [[timestamp, 1024 * 1024 * 50]], // 50MB
        tags: ['type:heap'],
        type: 'gauge',
      },
    ]);

    console.log('✅ Metrics exported successfully');

    console.log('\n📝 Exporting logs...');
    
    // Export some logs
    await exporter.exportLogs([
      {
        message: 'Example request processed successfully',
        level: 'info',
        tags: ['endpoint:/api/example', 'method:GET', 'status:200'],
      },
      {
        message: 'Database query executed',
        level: 'debug',
        tags: ['operation:select', 'table:users'],
        attributes: {
          queryTime: 45,
          rowsReturned: 10,
        },
      },
    ]);

    console.log('✅ Logs exported successfully');

    console.log('\n🔍 Exporting traces...');
    
    // Export some traces
    await exporter.exportTraces([
      {
        trace_id: 123456789,
        span_id: 987654321,
        name: 'http.request',
        resource: '/api/example',
        service: 'example-service',
        start: Date.now() * 1000000,
        duration: 125000000, // 125ms in nanoseconds
        type: 'web',
        meta: {
          'http.method': 'GET',
          'http.status_code': '200',
          'http.url': '/api/example',
        },
      },
      {
        trace_id: 123456789,
        span_id: 111111111,
        parent_id: 987654321,
        name: 'db.query',
        resource: 'SELECT * FROM users',
        service: 'example-service',
        start: (Date.now() + 10) * 1000000,
        duration: 45000000, // 45ms in nanoseconds
        type: 'sql',
        meta: {
          'db.type': 'postgresql',
          'db.statement': 'SELECT * FROM users WHERE id = ?',
        },
      },
    ]);

    console.log('✅ Traces exported successfully');

    console.log('\n📢 Exporting events...');
    
    // Export some events
    await exporter.exportEvents([
      {
        title: 'Example Event',
        text: 'This is an example event demonstrating the Datadog exporter functionality',
        priority: 'normal',
        alert_type: 'info',
        tags: ['example:basic-usage'],
      },
    ]);

    console.log('✅ Events exported successfully');

    console.log('\n📈 Getting exporter statistics...');
    
    // Get exporter statistics
    const stats = exporter.getStats();
    console.log('Exporter Statistics:', {
      metricsQueueSize: stats.metricsQueueSize,
      logsQueueSize: stats.logsQueueSize,
      tracesQueueSize: stats.tracesQueueSize,
      eventsQueueSize: stats.eventsQueueSize,
      isProcessing: stats.isProcessing,
      circuitBreakerState: stats.circuitBreakerState,
    });

    console.log('\n🔄 Flushing remaining data...');
    
    // Flush any remaining data
    await exporter.flush();
    console.log('✅ Data flushed successfully');

    console.log('\n🎉 Example completed successfully!');
    console.log('Check your Datadog dashboard to see the exported data.');

  } catch (error) {
    console.error('❌ Error during example:', error);
  } finally {
    console.log('\n🔒 Closing exporter...');
    
    // Always close the exporter to flush remaining data
    await exporter.close();
    console.log('✅ Exporter closed successfully');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the example
main().catch(console.error); 