# @rodrigopsasaki/datadog-exporter

A comprehensive, production-ready Datadog exporter for Node.js applications. This package provides a robust, type-safe, and efficient way to export metrics, logs, traces, and events to Datadog.

## Features

- 🚀 **High Performance**: Efficient batching and buffering with automatic flushing
- 🔒 **Type Safety**: Full TypeScript support with Zod validation
- 🛡️ **Reliability**: Circuit breaker pattern, retry logic, and error handling
- 📊 **Comprehensive**: Support for metrics, logs, traces, and events
- ⚙️ **Configurable**: Flexible configuration with sensible defaults
- 🧪 **Well Tested**: Comprehensive test suite with high coverage
- 📈 **Observable**: Built-in statistics and monitoring

## Installation

```bash
npm install @rodrigopsasaki/datadog-exporter
```

## Quick Start

```typescript
import { DatadogExporter } from '@rodrigopsasaki/datadog-exporter';

// Create exporter instance
const exporter = new DatadogExporter({
  apiKey: 'your-datadog-api-key',
  service: 'my-service',
  env: 'production',
  hostname: 'my-host',
  tags: ['env:production', 'service:my-service'],
});

// Export metrics
await exporter.exportMetrics([
  {
    metric: 'app.request.count',
    points: [[Date.now() / 1000, 42]],
    tags: ['endpoint:/api/users'],
    type: 'count',
  },
]);

// Export logs
await exporter.exportLogs([
  {
    message: 'User login successful',
    level: 'info',
    tags: ['user_id:123', 'action:login'],
  },
]);

// Export traces
await exporter.exportTraces([
  {
    trace_id: 123456789,
    span_id: 987654321,
    name: 'http.request',
    resource: '/api/users',
    service: 'my-service',
    start: Date.now() * 1000000,
    duration: 15000000, // 15ms in nanoseconds
  },
]);

// Export events
await exporter.exportEvents([
  {
    title: 'Deployment Successful',
    text: 'Version 1.2.3 deployed to production',
    priority: 'normal',
    alert_type: 'success',
  },
]);

// Flush remaining data and close
await exporter.close();
```

## Configuration

### Basic Configuration

```typescript
const config = {
  apiKey: 'your-datadog-api-key',        // Required
  service: 'my-service',                 // Required
  appKey: 'your-datadog-app-key',        // Optional
  site: 'datadoghq.com',                 // Optional, defaults to 'datadoghq.com'
  env: 'production',                     // Optional
  version: '1.0.0',                     // Optional
  hostname: 'my-host',                   // Optional
  tags: ['env:production'],              // Optional
};
```

### Advanced Configuration

```typescript
const config = {
  apiKey: 'your-datadog-api-key',
  service: 'my-service',
  
  // Network settings
  timeout: 10000,                        // HTTP timeout in ms
  retries: 3,                           // Number of retry attempts
  
  // Batching settings
  batchSize: 100,                       // Max items per batch
  flushInterval: 5000,                  // Auto-flush interval in ms
  
  // Feature flags
  enableMetrics: true,                  // Enable metric export
  enableLogs: true,                     // Enable log export
  enableTraces: true,                   // Enable trace export
};
```

### Supported Datadog Sites

- `datadoghq.com` (US1) - Default
- `datadoghq.eu` (EU)
- `us3.datadoghq.com` (US3)
- `us5.datadoghq.com` (US5)
- `ap1.datadoghq.com` (AP1)

## API Reference

### DatadogExporter

#### Constructor

```typescript
new DatadogExporter(config: DatadogConfig)
```

#### Methods

##### `exportMetrics(metrics: Metric[]): Promise<void>`

Export metrics to Datadog.

```typescript
await exporter.exportMetrics([
  {
    metric: 'app.request.count',
    points: [[timestamp, value]],
    tags: ['env:production'],
    type: 'count', // 'count' | 'gauge' | 'rate' | 'histogram' | 'distribution'
    host: 'my-host',
    interval: 60,
  },
]);
```

##### `exportLogs(logs: Log[]): Promise<void>`

Export logs to Datadog.

```typescript
await exporter.exportLogs([
  {
    message: 'User action completed',
    level: 'info', // 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug'
    service: 'my-service',
    hostname: 'my-host',
    tags: ['user_id:123'],
    attributes: { userId: '123', action: 'login' },
  },
]);
```

##### `exportTraces(spans: Span[]): Promise<void>`

Export traces to Datadog.

```typescript
await exporter.exportTraces([
  {
    trace_id: 123456789,
    span_id: 987654321,
    parent_id: 111111111, // Optional
    name: 'http.request',
    resource: '/api/users',
    service: 'my-service',
    type: 'web', // Optional
    start: Date.now() * 1000000, // Nanoseconds
    duration: 15000000, // Nanoseconds
    meta: { userId: '123' }, // Optional
    metrics: { sampling_priority: 1 }, // Optional
    error: 0, // Optional, 0 = no error, 1 = error
  },
]);
```

##### `exportEvents(events: Event[]): Promise<void>`

Export events to Datadog.

```typescript
await exporter.exportEvents([
  {
    title: 'Deployment Event',
    text: 'Version 1.2.3 deployed successfully',
    priority: 'normal', // 'normal' | 'low'
    host: 'my-host',
    tags: ['version:1.2.3'],
    alert_type: 'success', // 'info' | 'warning' | 'error' | 'success'
    aggregation_key: 'deployment-123',
    source_type_name: 'my-app',
  },
]);
```

##### `flush(): Promise<void>`

Manually flush all pending data.

##### `close(): Promise<void>`

Close the exporter and flush remaining data.

##### `getStats(): ExporterStats`

Get exporter statistics.

```typescript
const stats = exporter.getStats();
console.log(stats);
// {
//   metricsQueueSize: 0,
//   logsQueueSize: 5,
//   tracesQueueSize: 0,
//   eventsQueueSize: 0,
//   isProcessing: false,
//   circuitBreakerState: 'closed'
// }
```

## Data Types

### Metric

```typescript
interface Metric {
  metric: string;                    // Required: Metric name
  points: [number, number][];        // Required: Array of [timestamp, value] pairs
  tags?: string[];                   // Optional: Array of tags
  host?: string;                     // Optional: Host name
  type?: 'count' | 'gauge' | 'rate' | 'histogram' | 'distribution'; // Optional, defaults to 'gauge'
  interval?: number;                 // Optional: Interval in seconds
}
```

### Log

```typescript
interface Log {
  message: string;                   // Required: Log message
  timestamp?: number;                // Optional: Unix timestamp (seconds)
  level?: 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug'; // Optional, defaults to 'info'
  service?: string;                  // Optional: Service name
  hostname?: string;                 // Optional: Host name
  ddsource?: string;                 // Optional: Source name
  ddtags?: string;                   // Optional: Tags string
  host?: string;                     // Optional: Host name
  tags?: string[];                   // Optional: Array of tags
  attributes?: Record<string, unknown>; // Optional: Additional attributes
}
```

### Span

```typescript
interface Span {
  trace_id: number;                  // Required: Trace ID
  span_id: number;                   // Required: Span ID
  parent_id?: number;                // Optional: Parent span ID
  name: string;                      // Required: Span name
  resource: string;                  // Required: Resource name
  service: string;                   // Required: Service name
  type?: string;                     // Optional: Span type
  start: number;                     // Required: Start time in nanoseconds
  duration: number;                  // Required: Duration in nanoseconds
  meta?: Record<string, string>;     // Optional: Metadata
  metrics?: Record<string, number>;  // Optional: Metrics
  error?: number;                    // Optional: Error flag (0 or 1)
}
```

### Event

```typescript
interface Event {
  title: string;                     // Required: Event title
  text: string;                      // Required: Event text
  date_happened?: number;            // Optional: Unix timestamp (seconds)
  priority?: 'normal' | 'low';       // Optional, defaults to 'normal'
  host?: string;                     // Optional: Host name
  tags?: string[];                   // Optional: Array of tags
  alert_type?: 'info' | 'warning' | 'error' | 'success'; // Optional, defaults to 'info'
  aggregation_key?: string;          // Optional: Aggregation key
  source_type_name?: string;         // Optional: Source type name
}
```

## Error Handling

The exporter provides comprehensive error handling with custom error types:

### DatadogExportError

Thrown when export operations fail.

```typescript
import { DatadogExportError } from '@rodrigopsasaki/datadog-exporter';

try {
  await exporter.exportMetrics(metrics);
} catch (error) {
  if (error instanceof DatadogExportError) {
    console.error('Export failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Status code:', error.statusCode);
    console.error('Retryable:', error.retryable);
  }
}
```

### DatadogValidationError

Thrown when data validation fails.

```typescript
import { DatadogValidationError } from '@rodrigopsasaki/datadog-exporter';

try {
  await exporter.exportLogs(invalidLogs);
} catch (error) {
  if (error instanceof DatadogValidationError) {
    console.error('Validation failed:', error.message);
    console.error('Field:', error.field);
  }
}
```

## Circuit Breaker

The exporter implements a circuit breaker pattern to prevent cascading failures:

- **Closed**: Normal operation, requests are sent to Datadog
- **Open**: Circuit is open, requests fail fast without calling Datadog
- **Half-Open**: Circuit is testing if Datadog is back online

The circuit breaker opens after 5 consecutive failures and stays open for 30 seconds before testing recovery.

## Batching and Buffering

The exporter automatically batches data for efficient transmission:

- **Batch Size**: Configurable maximum items per batch (default: 100)
- **Flush Interval**: Automatic flush interval in milliseconds (default: 5000ms)
- **Manual Flush**: Call `flush()` to immediately send pending data
- **Graceful Shutdown**: Call `close()` to flush remaining data and stop processing

## Performance Considerations

- **Memory Usage**: Data is buffered in memory until flushed
- **Network Efficiency**: Automatic batching reduces API calls
- **Retry Logic**: Failed requests are retried with exponential backoff
- **Circuit Breaker**: Prevents overwhelming Datadog during outages
- **Validation**: Input validation happens before queuing

## Testing

The package includes comprehensive tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:dev

# Run tests with coverage
npm run test:coverage
```

## Examples

### Express.js Integration

```typescript
import express from 'express';
import { DatadogExporter } from '@rodrigopsasaki/datadog-exporter';

const app = express();
const exporter = new DatadogExporter({
  apiKey: process.env.DATADOG_API_KEY!,
  service: 'my-api',
  env: process.env.NODE_ENV,
});

// Middleware to track requests
app.use(async (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - start;
    
    // Export metrics
    await exporter.exportMetrics([
      {
        metric: 'http.request.duration',
        points: [[Date.now() / 1000, duration]],
        tags: [`method:${req.method}`, `status:${res.statusCode}`, `path:${req.path}`],
        type: 'histogram',
      },
      {
        metric: 'http.request.count',
        points: [[Date.now() / 1000, 1]],
        tags: [`method:${req.method}`, `status:${res.statusCode}`, `path:${req.path}`],
        type: 'count',
      },
    ]);

    // Export logs for errors
    if (res.statusCode >= 400) {
      await exporter.exportLogs([
        {
          message: `HTTP ${res.statusCode} ${req.method} ${req.path}`,
          level: res.statusCode >= 500 ? 'error' : 'warning',
          tags: [`method:${req.method}`, `path:${req.path}`, `status:${res.statusCode}`],
        },
      ]);
    }
  });
  
  next();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await exporter.close();
  process.exit(0);
});
```

### Custom Metrics Collection

```typescript
import { DatadogExporter } from '@rodrigopsasaki/datadog-exporter';

const exporter = new DatadogExporter({
  apiKey: process.env.DATADOG_API_KEY!,
  service: 'my-service',
});

// Custom metric collector
class MetricCollector {
  private metrics: Map<string, number> = new Map();

  increment(metric: string, value: number = 1, tags: string[] = []) {
    const key = `${metric}:${tags.sort().join(',')}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + value);
  }

  gauge(metric: string, value: number, tags: string[] = []) {
    const key = `${metric}:${tags.sort().join(',')}`;
    this.metrics.set(key, value);
  }

  async flush() {
    const timestamp = Date.now() / 1000;
    const metrics: any[] = [];

    for (const [key, value] of this.metrics) {
      const [metric, ...tagParts] = key.split(':');
      const tags = tagParts.length > 0 ? tagParts[0].split(',') : [];
      
      metrics.push({
        metric,
        points: [[timestamp, value]],
        tags,
        type: 'gauge',
      });
    }

    if (metrics.length > 0) {
      await exporter.exportMetrics(metrics);
      this.metrics.clear();
    }
  }
}

const collector = new MetricCollector();

// Use the collector
collector.increment('user.login', 1, ['method:email']);
collector.gauge('memory.usage', process.memoryUsage().heapUsed, ['type:heap']);

// Flush every minute
setInterval(() => collector.flush(), 60000);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details. 