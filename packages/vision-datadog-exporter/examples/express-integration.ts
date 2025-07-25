#!/usr/bin/env tsx

/**
 * Express.js integration example for @rodrigopsasaki/datadog-exporter
 * 
 * This example demonstrates how to integrate the Datadog exporter
 * with an Express.js application to automatically track requests,
 * responses, and errors.
 * 
 * To run this example:
 * 1. Set your Datadog API key: export DATADOG_API_KEY=your-api-key
 * 2. Install Express: npm install express
 * 3. Run: npx tsx examples/express-integration.ts
 */

import express from 'express';
import { DatadogExporter } from '../src/datadog-exporter.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create Datadog exporter
const exporter = new DatadogExporter({
  apiKey: process.env.DATADOG_API_KEY || 'demo-api-key',
  service: 'express-example',
  env: 'development',
  hostname: 'express-host',
  tags: ['env:development', 'service:express-example'],
  timeout: 5000,
  retries: 2,
  batchSize: 20,
  flushInterval: 3000,
});

// Middleware to parse JSON
app.use(express.json());

// Middleware to track requests and responses
app.use(async (req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request start
  await exporter.exportLogs([
    {
      message: `Request started: ${req.method} ${req.path}`,
      level: 'info',
      tags: [
        `request_id:${requestId}`,
        `method:${req.method}`,
        `path:${req.path}`,
        `user_agent:${req.get('User-Agent') || 'unknown'}`,
      ],
    },
  ]);

  // Override res.end to capture response data
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    // Export metrics
    exporter.exportMetrics([
      {
        metric: 'http.request.duration',
        points: [[Date.now() / 1000, duration]],
        tags: [
          `method:${req.method}`,
          `path:${req.path}`,
          `status:${statusCode}`,
          `request_id:${requestId}`,
        ],
        type: 'histogram',
      },
      {
        metric: 'http.request.count',
        points: [[Date.now() / 1000, 1]],
        tags: [
          `method:${req.method}`,
          `path:${req.path}`,
          `status:${statusCode}`,
          `request_id:${requestId}`,
        ],
        type: 'count',
      },
    ]);

    // Export traces
    exporter.exportTraces([
      {
        trace_id: parseInt(requestId, 36),
        span_id: Math.floor(Math.random() * 1000000000),
        name: 'http.request',
        resource: `${req.method} ${req.path}`,
        service: 'express-example',
        start: start * 1000000, // Convert to nanoseconds
        duration: duration * 1000000, // Convert to nanoseconds
        type: 'web',
        meta: {
          'http.method': req.method,
          'http.url': req.path,
          'http.status_code': statusCode.toString(),
          'http.user_agent': req.get('User-Agent') || 'unknown',
          'request_id': requestId,
        },
        error: statusCode >= 400 ? 1 : 0,
      },
    ]);

    // Export logs based on response
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info';
    const logMessage = statusCode >= 400 
      ? `Request failed: ${req.method} ${req.path} - ${statusCode}`
      : `Request completed: ${req.method} ${req.path} - ${statusCode}`;

    exporter.exportLogs([
      {
        message: logMessage,
        level: logLevel,
        tags: [
          `request_id:${requestId}`,
          `method:${req.method}`,
          `path:${req.path}`,
          `status:${statusCode}`,
          `duration:${duration}ms`,
        ],
        attributes: {
          requestId,
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          userAgent: req.get('User-Agent'),
        },
      },
    ]);

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express with Datadog integration!' });
});

app.get('/users', async (req, res) => {
  try {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const users = [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' },
    ];
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/slow', async (req, res) => {
  // Simulate slow endpoint
  await new Promise(resolve => setTimeout(resolve, 2000));
  res.json({ message: 'Slow response completed' });
});

app.get('/error', (req, res) => {
  res.status(500).json({ error: 'Simulated error' });
});

app.get('/not-found', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = exporter.getStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    exporter: {
      metricsQueueSize: stats.metricsQueueSize,
      logsQueueSize: stats.logsQueueSize,
      tracesQueueSize: stats.tracesQueueSize,
      eventsQueueSize: stats.eventsQueueSize,
      isProcessing: stats.isProcessing,
      circuitBreakerState: stats.circuitBreakerState,
    },
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Export error event
  exporter.exportEvents([
    {
      title: 'Unhandled Error',
      text: `Unhandled error in ${req.method} ${req.path}: ${err.message}`,
      alert_type: 'error',
      priority: 'normal',
      tags: [
        `method:${req.method}`,
        `path:${req.path}`,
        'type:unhandled_error',
      ],
    },
  ]);

  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔍 Datadog exporter is active and collecting data`);
  console.log(`\nTry these endpoints:`);
  console.log(`  GET http://localhost:${PORT}/`);
  console.log(`  GET http://localhost:${PORT}/users`);
  console.log(`  GET http://localhost:${PORT}/slow`);
  console.log(`  GET http://localhost:${PORT}/error`);
  console.log(`  GET http://localhost:${PORT}/not-found`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  // Close the exporter to flush remaining data
  await exporter.close();
  
  console.log('✅ Exporter closed successfully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  
  // Close the exporter to flush remaining data
  await exporter.close();
  
  console.log('✅ Exporter closed successfully');
  process.exit(0);
});

// Periodic stats logging
setInterval(() => {
  const stats = exporter.getStats();
  console.log('📈 Exporter Stats:', {
    metricsQueueSize: stats.metricsQueueSize,
    logsQueueSize: stats.logsQueueSize,
    tracesQueueSize: stats.tracesQueueSize,
    eventsQueueSize: stats.eventsQueueSize,
    isProcessing: stats.isProcessing,
    circuitBreakerState: stats.circuitBreakerState,
  });
}, 30000); // Log stats every 30 seconds 