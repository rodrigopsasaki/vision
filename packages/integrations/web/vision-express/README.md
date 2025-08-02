# @rodrigopsasaki/vision-express

Express middleware for seamless Vision context integration. Automatically creates structured observability contexts for HTTP requests with intelligent defaults and simplified configuration.

## Features

- **Just Works Out of the Box**: No configuration required - intelligent defaults handle everything
- **Smart User Detection**: Automatically detects users from common authentication patterns
- **Smart Correlation ID Detection**: Finds correlation IDs from common headers
- **Security by Default**: Sensitive data is automatically redacted
- **Automatic Context Creation**: Every HTTP request gets wrapped in a Vision context
- **Comprehensive Metadata Capture**: Request/response data, headers, timing, errors
- **Route Exclusion**: Health checks and metrics endpoints excluded by default
- **TypeScript Support**: Full type safety with extended Express interfaces
- **Error Handling**: Automatic error capture and context preservation

## Installation

```bash
npm install @rodrigopsasaki/vision-express
npm install @rodrigopsasaki/vision
```

## Quick Start

```typescript
import express from "express";
import { vision } from "@rodrigopsasaki/vision";
import { visionMiddleware } from "@rodrigopsasaki/vision-express";

const app = express();

// Initialize Vision with exporters
vision.init({
  exporters: [
    // Your exporters here
  ],
});

// Add the Vision middleware - just works out of the box!
app.use(visionMiddleware());

// Your routes now have automatic context tracking
app.get("/users/:id", async (req, res) => {
  // Add custom data to the context
  vision.set("user_id", req.params.id);
  vision.set("operation", "get_user");

  const user = await getUser(req.params.id);
  res.json(user);
});
```

## API Reference

### `visionMiddleware(options?)`

The recommended default middleware - just works out of the box with intelligent defaults.

```typescript
import { visionMiddleware } from "@rodrigopsasaki/vision-express";

// Basic usage - no configuration needed
app.use(visionMiddleware());

// With custom options
app.use(
  visionMiddleware({
    captureBody: true,
    excludeRoutes: ["/health", "/metrics"],
    extractUser: (req) => req.headers["x-user-id"],
  }),
);
```

### `createVisionMiddleware(options?)`

Creates a Vision Express middleware with custom configuration.

```typescript
import { createVisionMiddleware } from "@rodrigopsasaki/vision-express";

app.use(
  createVisionMiddleware({
    captureBody: true,
    excludeRoutes: ["/health", "/metrics"],
    extractUser: (req) => req.user,
  }),
);
```

### `createMinimalVisionMiddleware()`

Creates a middleware with no Express metadata capture - perfect for when you want Vision context but no Express clutter.

```typescript
import { createMinimalVisionMiddleware } from "@rodrigopsasaki/vision-express";

app.use(createMinimalVisionMiddleware());
```

### `createComprehensiveVisionMiddleware()`

Creates a middleware that captures all available data including request bodies (use with caution).

```typescript
import { createComprehensiveVisionMiddleware } from "@rodrigopsasaki/vision-express";

app.use(createComprehensiveVisionMiddleware());
```

### `createSecureVisionMiddleware()`

Creates a middleware with extra security redaction - perfect for high-security applications.

```typescript
import { createSecureVisionMiddleware } from "@rodrigopsasaki/vision-express";

app.use(createSecureVisionMiddleware());
```

## Configuration Options

### Basic Options

| Option               | Type       | Default                                              | Description                                        |
| -------------------- | ---------- | ---------------------------------------------------- | -------------------------------------------------- |
| `enabled`            | `boolean`  | `true`                                               | Whether the middleware is enabled                  |
| `excludeRoutes`      | `string[]` | `["/health", "/metrics", "/status", "/favicon.ico"]` | Routes to exclude from tracking                    |
| `captureHeaders`     | `boolean`  | `true`                                               | Capture request headers                            |
| `captureQueryParams` | `boolean`  | `true`                                               | Capture query parameters                           |
| `captureBody`        | `boolean`  | `false`                                              | Capture request body (off by default for security) |

### Smart Detection Options

| Option                 | Type               | Default         | Description                          |
| ---------------------- | ------------------ | --------------- | ------------------------------------ |
| `extractUser`          | `(req) => unknown` | Smart detection | Extract user from common patterns    |
| `correlationIdHeaders` | `string[]`         | Common headers  | Headers to check for correlation IDs |

### Security Options

| Option              | Type       | Default           | Description            |
| ------------------- | ---------- | ----------------- | ---------------------- |
| `redactHeaders`     | `string[]` | Sensitive headers | Headers to redact      |
| `redactQueryParams` | `string[]` | Sensitive params  | Query params to redact |
| `redactBodyFields`  | `string[]` | Sensitive fields  | Body fields to redact  |

### Response Options

| Option             | Type      | Default        | Description                        |
| ------------------ | --------- | -------------- | ---------------------------------- |
| `includeRequestId` | `boolean` | `true`         | Add request ID to response headers |
| `requestIdHeader`  | `string`  | `X-Request-ID` | Header name for request ID         |

## Smart Defaults

### User Detection

The middleware automatically tries to extract user information from common patterns:

```typescript
// Tries these in order:
req.user; // Passport.js, JWT middleware
req.session.user; // Session-based auth
req.headers["x-user-id"]; // Custom header
req.headers["x-user"]; // Custom header
```

### Correlation ID Detection

Automatically finds correlation IDs from common headers:

```typescript
// Tries these headers in order:
"x-correlation-id";
"x-request-id";
"x-trace-id";
"x-transaction-id";
"correlation-id";
"request-id";
```

### Security Redaction

By default, these fields are automatically redacted:

**Headers:**

- `authorization`
- `cookie`
- `x-api-key`
- `x-auth-token`
- `x-session-token`
- `x-csrf-token`

**Query Parameters:**

- `token`
- `key`
- `secret`
- `password`
- `auth`
- `api_key`

**Body Fields:**

- `password`
- `ssn`
- `credit_card`
- `secret`
- `api_key`
- `private_key`

## Usage Examples

### Basic Usage (Recommended)

```typescript
import express from "express";
import { vision } from "@rodrigopsasaki/vision";
import { visionMiddleware } from "@rodrigopsasaki/vision-express";

const app = express();

// Initialize Vision
vision.init({
  exporters: [
    {
      name: "console",
      success: (ctx) => console.log("Request completed:", ctx),
      error: (ctx, err) => console.error("Request failed:", ctx, err),
    },
  ],
});

// Add middleware - just works out of the box!
app.use(visionMiddleware());

// Your routes
app.get("/api/users/:id", async (req, res) => {
  vision.set("user_id", req.params.id);
  vision.set("operation", "get_user");

  const user = await getUser(req.params.id);
  res.json(user);
});
```

### Custom Configuration

```typescript
import express from "express";
import { visionMiddleware } from "@rodrigopsasaki/vision-express";

const app = express();

app.use(
  visionMiddleware({
    // Enable body capture for development
    captureBody: true,

    // Exclude additional routes
    excludeRoutes: ["/health", "/metrics", "/status", "/static", "/favicon.ico"],

    // Custom user extraction
    extractUser: (req) => (req as any).user || req.headers["x-user-id"],

    // Custom correlation ID headers
    correlationIdHeaders: ["x-correlation-id", "x-request-id", "x-trace-id"],

    // Additional security redaction
    redactHeaders: [
      "authorization",
      "cookie",
      "x-api-key",
      "x-auth-token",
      "x-session-token",
      "x-csrf-token",
    ],
    redactQueryParams: ["token", "key", "secret", "password", "auth"],
    redactBodyFields: ["password", "ssn", "credit_card", "secret", "api_key"],
  }),
);
```

### Different Middleware Options

```typescript
import express from "express";
import {
  visionMiddleware,
  createMinimalVisionMiddleware,
  createComprehensiveVisionMiddleware,
  createSecureVisionMiddleware,
} from "@rodrigopsasaki/vision-express";

const app = express();

// Option 1: Simple Vision (default) - just works out of the box
app.use(visionMiddleware());

// Option 2: Minimal Vision - no Express metadata clutter
app.use(createMinimalVisionMiddleware());

// Option 3: Comprehensive Vision - everything including body
app.use(createComprehensiveVisionMiddleware());

// Option 4: Secure Vision - extra security protection
app.use(createSecureVisionMiddleware());
```

### Accessing Context in Routes

```typescript
import type { VisionRequest } from "@rodrigopsasaki/vision-express";

app.get("/users/:id", async (req: VisionRequest, res) => {
  // Access the Vision context
  const ctx = req.visionContext;
  console.log("Request ID:", ctx.id);

  // Add data to the context
  vision.set("user_id", req.params.id);
  vision.set("operation", "get_user");
  vision.set("timestamp", new Date().toISOString());

  // Add structured data
  vision.merge("request", {
    method: req.method,
    path: req.path,
    query: req.query,
  });

  // Add to arrays
  vision.push("events", "user_lookup_started");

  const user = await getUser(req.params.id);

  vision.push("events", "user_lookup_completed");
  vision.set("result_count", 1);

  res.json(user);
});
```

### Testing with Headers

```bash
# Basic request
curl http://localhost:3000/users/123

# With correlation ID
curl -H "X-Correlation-ID: test-123" http://localhost:3000/users/123

# With user context
curl -H "X-User-ID: user-456" http://localhost:3000/users/123

# With sensitive data (automatically redacted)
curl -H "Authorization: Bearer secret-token" \
     -H "Cookie: session=abc123" \
     "http://localhost:3000/users/123?token=secret&password=123456"
```

## Captured Data

The middleware automatically captures the following data:

### Request Data

- HTTP method and path
- Request headers (with automatic redaction)
- Query parameters (with automatic redaction)
- Request body (optional, with automatic redaction)
- Correlation ID (if found in headers)
- User information (if found)

### Response Data

- Status code
- Response headers
- Duration (timing)

## TypeScript Support

The package provides extended Express interfaces:

```typescript
import type { VisionRequest, VisionResponse } from "@rodrigopsasaki/vision-express";

app.get("/users/:id", (req: VisionRequest, res: VisionResponse) => {
  // req.visionContext is available
  const ctx = req.visionContext;

  // Add data to context
  vision.set("user_id", req.params.id);
});
```

## Security Considerations

- **Request Bodies**: Disabled by default to prevent logging sensitive data
- **Automatic Redaction**: Common sensitive fields are redacted by default
- **Custom Redaction**: Configure which fields to redact based on your needs
- **Route Exclusion**: Health checks and metrics endpoints excluded by default

## Best Practices

1. **Use Default Middleware**: Start with `visionMiddleware()` - it just works
2. **Initialize Vision First**: Always initialize Vision with exporters before adding the middleware
3. **Customize When Needed**: Only configure options when you need to override defaults
4. **Use Route Exclusion**: Add custom routes to exclude if needed
5. **Review Redaction**: Ensure sensitive data is properly redacted for your use case
6. **Handle Errors Gracefully**: Let Vision capture errors automatically
7. **Use TypeScript**: Leverage the provided types for better development experience

## Integration with Exporters

The middleware works seamlessly with any Vision exporter:

```typescript
import { vision } from "@rodrigopsasaki/vision";
import { createDatadogExporter } from "@rodrigopsasaki/vision-datadog-exporter";

// Initialize with exporters
vision.init({
  exporters: [
    createDatadogExporter({
      apiKey: process.env.DATADOG_API_KEY,
      service: "my-api",
    }),
  ],
});

// Add middleware - just works!
app.use(visionMiddleware());
```

## License

MIT
