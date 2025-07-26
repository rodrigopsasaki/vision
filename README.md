# Vision

A structured observability framework for Node.js applications. Vision provides a simple, powerful way to capture, enrich, and export observability data from your applications.

## Features

- 🎯 **Structured contexts** - Capture and enrich observability data with key-value metadata
- 🔌 **Pluggable exporters** - Send data to any observability platform
- 🪶 **Lightweight** - Minimal overhead, maximum insight
- 🛡️ **Type-safe** - Full TypeScript support with excellent DX
- 🧩 **Extensible** - Easy to extend with custom exporters and transformations

## Quick Start

```typescript
import { vision } from "@rodrigopsasaki/vision";

// Initialize with exporters
vision.init({
  exporters: [
    // Add exporters here
  ],
});

// Observe operations with structured context
await vision.observe("user.login", async () => {
  vision.set("user_id", "user123");
  vision.set("method", "email");
  vision.set("ip_address", req.ip);

  // Your business logic here
  const user = await authenticate(email, password);

  vision.set("success", true);
  vision.set("user_role", user.role);
});
```

## Core Concepts

### Contexts

Vision contexts are scoped units of work that capture structured metadata:

```typescript
await vision.observe(
  "payment.process",
  {
    scope: "http-server",
    source: "payment-service",
  },
  async () => {
    vision.set("payment_id", paymentId);
    vision.set("amount", amount);
    vision.set("currency", "USD");

    // Process payment...
  },
);
```

### Exporters

Exporters receive completed contexts and send them to observability platforms:

```typescript
import { createDatadogExporter } from "@rodrigopsasaki/vision-datadog-exporter";
import { createHoneycombExporter } from "@rodrigopsasaki/vision-honeycomb-exporter";

vision.init({
  exporters: [
    createDatadogExporter({
      apiKey: process.env.DATADOG_API_KEY,
      service: "my-service",
    }),
    createHoneycombExporter({
      apiKey: process.env.HONEYCOMB_API_KEY,
      dataset: "my-dataset",
    }),
  ],
});
```

## Available Exporters

Vision follows a modular architecture where each exporter is a separate package:

- **[@rodrigopsasaki/vision-datadog-exporter](./packages/vision-datadog-exporter)** - Export to Datadog as distributed traces, metrics, logs, or events

_More exporters coming soon..._

## Creating Custom Exporters

Exporters implement the `VisionExporter` interface:

```typescript
import type { VisionExporter, VisionContext } from "@rodrigopsasaki/vision";

export const myExporter: VisionExporter = {
  name: "my-exporter",

  success(context: VisionContext) {
    // Handle successful context completion
    console.log("Context completed:", context.name, context.data);
  },

  error(context: VisionContext, error: unknown) {
    // Handle context failure
    console.error("Context failed:", context.name, error);
  },

  // Optional lifecycle hooks
  before(context: VisionContext) {
    // Called before context execution
  },

  after(context: VisionContext) {
    // Called after successful execution
  },

  onError(context: VisionContext, error: unknown) {
    // Called after failed execution
  },
};
```

## API Reference

### `vision.init(options)`

Initialize Vision with configuration:

```typescript
vision.init({
  exporters: VisionExporter[],  // Array of exporters
});
```

### `vision.observe(name, options?, fn)`

Create and execute a new context:

```typescript
await vision.observe(
  'operation-name',           // Context name
  {                          // Optional context options
    scope?: string,          // Context scope/category
    source?: string,         // Context source identifier
    initial?: Record<string, unknown>, // Initial context data
  },
  async () => {              // Function to execute
    // Your code here
  }
);
```

### Context Manipulation

Within an observed context:

```typescript
// Set values
vision.set("key", value);

// Get values
const value = vision.get("key");

// Append to arrays
vision.push("items", newItem);

// Merge objects
vision.merge("metadata", { additional: "data" });
```

## Packages

This monorepo contains:

- **[@rodrigopsasaki/vision](./packages/vision)** - Core Vision framework
- **[@rodrigopsasaki/vision-datadog-exporter](./packages/vision-datadog-exporter)** - Datadog exporter

## License

MIT
