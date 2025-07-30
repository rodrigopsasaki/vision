# Vision

A structured observability framework for Node.js applications. Vision provides a simple, powerful way to capture, enrich, and export observability data from your applications.

## Features

- 🎯 **Structured contexts** - Capture and enrich observability data with key-value metadata
- 🔌 **Pluggable exporters** - Send data to any observability platform
- 🔄 **Key normalization** - Automatic consistent casing (snake_case, camelCase, kebab-case, PascalCase)
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

## Key Normalization

Vision automatically normalizes context keys to ensure consistent casing across all your observability data. This eliminates the inconsistency that comes from different developers using different naming conventions.

### Basic Usage

```typescript
// Enable snake_case normalization
vision.init({
  normalization: {
    enabled: true,
    keyCasing: "snake_case",
    deep: true
  }
});

await vision.observe("user.registration", async () => {
  // You write keys however feels natural
  vision.set("userId", "user123");
  vision.set("firstName", "John");
  vision.set("lastLoginAt", "2023-01-01");
  
  // Exporters receive normalized keys:
  // user_id, first_name, last_login_at
});
```

### Supported Casing Styles

Vision supports five casing styles to match your observability platform's conventions:

```typescript
// snake_case (recommended for most observability platforms)
vision.init({ normalization: { enabled: true, keyCasing: "snake_case" } });
// Input: userId, firstName → Output: user_id, first_name

// camelCase (JavaScript/TypeScript standard)
vision.init({ normalization: { enabled: true, keyCasing: "camelCase" } });
// Input: user_id, first_name → Output: userId, firstName

// kebab-case (CSS/HTML style)
vision.init({ normalization: { enabled: true, keyCasing: "kebab-case" } });
// Input: userId, firstName → Output: user-id, first-name

// PascalCase (class naming style)
vision.init({ normalization: { enabled: true, keyCasing: "PascalCase" } });
// Input: userId, firstName → Output: UserId, FirstName

// none (disable normalization)
vision.init({ normalization: { enabled: false, keyCasing: "none" } });
// Keys remain exactly as you set them
```

### Deep Normalization

By default, Vision normalizes keys in nested objects and arrays recursively:

```typescript
vision.init({
  normalization: {
    enabled: true,
    keyCasing: "snake_case",
    deep: true  // Default: normalize nested keys too
  }
});

await vision.observe("user.profile.update", async () => {
  vision.set("userProfile", {
    personalInfo: {
      firstName: "Jane",
      lastName: "Smith",
      birthDate: "1990-01-15"
    },
    contactDetails: {
      emailAddress: "jane@example.com",
      phoneNumber: "+1-555-1234"
    }
  });
  
  // All nested keys are normalized:
  // user_profile.personal_info.first_name
  // user_profile.personal_info.last_name
  // user_profile.contact_details.email_address
  // user_profile.contact_details.phone_number
});
```

### Shallow Normalization

For performance-sensitive applications or when you only want top-level key normalization:

```typescript
vision.init({
  normalization: {
    enabled: true,
    keyCasing: "snake_case",
    deep: false  // Only normalize top-level keys
  }
});

await vision.observe("api.request", async () => {
  vision.set("requestData", {
    httpMethod: "POST",  // This stays as-is
    requestPath: "/api/users"  // This stays as-is
  });
  
  // Only top-level key is normalized:
  // request_data.httpMethod (nested keys unchanged)
  // request_data.requestPath (nested keys unchanged)
});
```

### Working with Arrays

Normalization works seamlessly with arrays and the `push()` operation:

```typescript
await vision.observe("order.processing", async () => {
  vision.push("orderItems", {
    productId: "prod-123",
    productName: "Widget",
    unitPrice: 29.99
  });
  
  vision.push("orderItems", {
    productId: "prod-456",
    productName: "Gadget", 
    unitPrice: 19.99
  });
  
  // Results in normalized array:
  // order_items[0].product_id, order_items[0].product_name
  // order_items[1].product_id, order_items[1].product_name
});
```

### Configuration Options

```typescript
interface NormalizationConfig {
  enabled: boolean;     // Enable/disable normalization (default: false)
  keyCasing: string;    // Target casing style (default: "none")
  deep: boolean;        // Normalize nested objects (default: true)
}

// Examples
vision.init({
  normalization: {
    enabled: true,        // Turn on normalization
    keyCasing: "snake_case", // Use snake_case
    deep: true           // Normalize all nested keys
  }
});
```

### Why Use Key Normalization?

**Consistency**: No more mixed casing in your dashboards (`userId` vs `user_id` vs `user-id`)

**Platform Compatibility**: Match your observability platform's conventions automatically

**Team Collaboration**: Different developers can use their preferred naming style

**Migration**: Easily switch between casing conventions without code changes

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
  normalization?: {             // Key normalization options
    enabled: boolean,           // Enable normalization (default: false)
    keyCasing: "camelCase" | "snake_case" | "kebab-case" | "PascalCase" | "none",
    deep: boolean               // Normalize nested keys (default: true)
  }
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

## 🙏 Acknowledgments

Special thanks to [Ryan McGrath](https://github.com/zoltrain), the brilliant Go-savvy engineer who first introduced me to the power of propagating structured context across services. This project is a direct descendant of those conversations — just ported to a new ecosystem with the same care for clarity, pragmatism and the value of sharing good ideas.

## License

MIT
