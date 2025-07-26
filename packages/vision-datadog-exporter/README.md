# @rodrigopsasaki/vision-datadog-exporter

A production-ready Datadog exporter for [@rodrigopsasaki/vision](https://github.com/rodrigopsasaki/vision). Ships with sensible defaults: just plug it into Vision and get distributed traces with rich metadata exported to Datadog.

## Features

- 📦 **Plug-and-play** Vision exporter for Datadog
- 🪄 **Sensible defaults** - exports Vision contexts as OpenTelemetry-compliant distributed traces
- 🧩 **Extensible** - override transformation logic for custom needs
- 🛡️ **Type-safe** - Zod-validated configuration with full TypeScript support
- 🏷️ **Rich metadata** - all Vision context data included as span metadata
- ⚡ **Production-ready** - circuit breaker, retries, batching, and proper error handling
- 🔄 **Multiple export modes** - traces (default), metrics, logs, or events

## Installation

```sh
pnpm add @rodrigopsasaki/vision-datadog-exporter
# or
yarn add @rodrigopsasaki/vision-datadog-exporter
# or
npm install @rodrigopsasaki/vision-datadog-exporter
```

## Quick Start

```typescript
import { vision } from "@rodrigopsasaki/vision";
import { createDatadogExporter } from "@rodrigopsasaki/vision-datadog-exporter";

vision.init({
  exporters: [
    createDatadogExporter({
      apiKey: "your-datadog-api-key",
      service: "my-service",
      env: "production",
      // Optional: exportMode: 'trace' | 'metric' | 'log' | 'event'
    }),
  ],
});

// Vision contexts automatically become distributed traces in Datadog
await vision.observe("user.login", async () => {
  vision.set("user_id", "user123");
  vision.set("method", "email");
  // ... work happens ...
});
```

## Configuration

All config options are type-safe and Zod-validated:

```typescript
createDatadogExporter({
  // Required
  apiKey: "your-datadog-api-key",
  service: "my-service",

  // Common options
  env: "production", // Environment tag
  exportMode: "trace", // 'trace' | 'metric' | 'log' | 'event'
  site: "datadoghq.com", // Datadog site

  // Behavior options
  includeContextData: true, // Include all Vision context data as metadata
  includeTiming: true, // Include duration information
  includeErrorDetails: true, // Include error stack traces

  // Performance options
  batchSize: 100, // Batch size for exports
  flushInterval: 5000, // Max time to wait before flushing (ms)
  timeout: 10000, // HTTP request timeout (ms)
  retries: 3, // Number of retries on failure

  // Optional
  tags: ["team:backend", "version:1.0"], // Extra tags for all exports
  hostname: "my-host", // Override hostname
});
```

## OpenTelemetry Compliance

This exporter generates OpenTelemetry-compliant distributed traces:

- **Consistent trace/span IDs** generated from Vision context IDs
- **Proper span kinds** mapped from Vision context scope (server, client, producer, consumer, internal)
- **Rich metadata** including library info, service names, and all context data
- **Error handling** with proper error spans and metadata

### Span Kind Mapping

The exporter intelligently maps Vision context scopes to OpenTelemetry span kinds:

- `http*`, `api*`, `request*` → `server`
- `client*`, `fetch*`, `call*` → `client`
- `producer*`, `publish*` → `producer`
- `consumer*`, `subscribe*` → `consumer`
- Everything else → `internal`

## Extension

You can extend the transformation logic by subclassing `VisionDatadogTransformer`:

```typescript
import {
  VisionDatadogTransformer,
  createDatadogExporter,
} from "@rodrigopsasaki/vision-datadog-exporter";

class MyTransformer extends VisionDatadogTransformer {
  toSpan(context, error) {
    const span = super.toSpan(context, error);

    // Add custom metadata
    span.meta["custom.field"] = "value";

    // Custom span naming
    if (context.scope === "database") {
      span.name = `db.${context.name}`;
    }

    return span;
  }
}

const exporter = createDatadogExporter({
  apiKey: "key",
  service: "svc",
});

// Replace the transformer
exporter.transformer = new MyTransformer(exporter.config);
```

## Production Features

### Circuit Breaker

Automatically opens circuit to prevent cascading failures when Datadog is unavailable.

### Batching

Efficiently batches exports to reduce API calls and improve performance.

### Retries

Exponential backoff retries with intelligent error classification.

### Monitoring

```typescript
const exporter = createDatadogExporter({...});

// Get export statistics
const stats = exporter.getStats();
console.log(stats.queueSize);           // Current queue size
console.log(stats.isProcessing);        // Is currently exporting
console.log(stats.circuitBreakerState); // 'closed' | 'open' | 'half-open'
```

## Vision Usage Example

```typescript
import { vision } from "@rodrigopsasaki/vision";
import { createDatadogExporter } from "@rodrigopsasaki/vision-datadog-exporter";

vision.init({
  exporters: [createDatadogExporter({ apiKey: "...", service: "..." })],
});

// HTTP request handling
await vision.observe("user.profile.get", { scope: "http-server" }, async () => {
  vision.set("user_id", req.user.id);
  vision.set("endpoint", "/profile");

  // Database query
  await vision.observe("user.fetch", { scope: "database" }, async () => {
    const user = await db.user.findUnique({ where: { id: req.user.id } });
    vision.set("query_time_ms", 42);
    return user;
  });
});
```

This creates a distributed trace in Datadog showing the full request flow with timing, metadata, and proper parent-child span relationships.

## License

MIT
