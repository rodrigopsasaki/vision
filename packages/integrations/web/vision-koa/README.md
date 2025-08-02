# 🎯 @rodrigopsasaki/vision-koa

Elegant **Koa middleware** for seamless [Vision](https://github.com/rodrigopsasaki/vision) context integration. Designed for simplicity, built for observability.

## ✨ Features

- 🧘 **Zen-like simplicity** - Fits Koa's minimalist philosophy
- 🎯 **Automatic context creation** - Every request gets a Vision context
- ⚡ **Async/await native** - Built for modern async patterns
- 🔒 **Security-first** - Smart sensitive data redaction
- 🎨 **Highly configurable** - From minimal to comprehensive tracking
- 🔄 **Middleware composable** - Works with all Koa middleware
- 📊 **Rich metadata capture** - State, cookies, headers, and more
- 🏗️ **TypeScript first** - Full type safety and IntelliSense

## 🚀 Quick Start

```bash
npm install @rodrigopsasaki/vision @rodrigopsasaki/vision-koa
```

```typescript
import Koa from "koa";
import { createVisionMiddleware } from "@rodrigopsasaki/vision-koa";

const app = new Koa();

// Register the Vision middleware
app.use(createVisionMiddleware());

app.use(async (ctx, next) => {
  // Vision context is automatically available
  vision.set("user_id", ctx.params?.id);
  vision.set("operation", "get_data");

  ctx.body = { message: "Hello, World!" };
});

app.listen(3000);
```

## 🎛️ Configuration Options

### Basic Configuration

```typescript
app.use(
  createVisionMiddleware({
    // Data capture options
    captureHeaders: true,
    captureBody: false, // Be careful in production
    captureQuery: true,
    captureParams: true,

    // Performance tracking
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 1000, // 1 second
      trackMemoryUsage: false,
    },

    // Security & privacy
    redactSensitiveData: true,
    redactHeaders: ["authorization", "cookie"],
    redactQueryParams: ["token", "password"],
    redactBodyFields: ["password", "ssn"],
  }),
);
```

### Advanced Configuration

```typescript
app.use(
  createVisionMiddleware({
    // Custom extractors
    extractUser: (ctx) => ({
      id: ctx.headers["x-user-id"],
      role: ctx.state.userRole,
    }),

    extractCorrelationId: (ctx) => ctx.headers["x-correlation-id"] || ctx.headers["x-request-id"],

    extractMetadata: (ctx) => ({
      client_version: ctx.headers["x-client-version"],
      session_id: ctx.cookies.get("session_id"),
      feature_flags: ctx.state.featureFlags,
    }),

    // Custom context naming
    contextNameGenerator: (ctx) => `api.${ctx.method.toLowerCase()}.${ctx.path}`,

    // Route exclusion
    excludeRoutes: ["/health", "/metrics", "/docs/*"],
    shouldExcludeRoute: (ctx) => ctx.path.startsWith("/internal/"),
  }),
);
```

## 🎨 Pre-configured Middleware

### Minimal Middleware (Performance Optimized)

```typescript
import { createMinimalVisionMiddleware } from "@rodrigopsasaki/vision-koa";

app.use(
  createMinimalVisionMiddleware({
    performance: { slowOperationThreshold: 100 },
  }),
);
```

### Comprehensive Middleware (Full Observability)

```typescript
import { createComprehensiveVisionMiddleware } from "@rodrigopsasaki/vision-koa";

app.use(
  createComprehensiveVisionMiddleware({
    captureBody: true,
    performance: { trackMemoryUsage: true },
  }),
);
```

### Performance Middleware (Ultra-fast)

```typescript
import { createPerformanceVisionMiddleware } from "@rodrigopsasaki/vision-koa";

app.use(createPerformanceVisionMiddleware());
```

### Secure Middleware (Enhanced Security)

```typescript
import { createSecureVisionMiddleware } from "@rodrigopsasaki/vision-koa";

app.use(
  createSecureVisionMiddleware({
    // Automatically configured for maximum security
    captureBody: false,
    redactSensitiveData: true,
  }),
);
```

## 📊 Vision API Usage

Use the full power of Vision's API within your middleware:

```typescript
app.use(async (ctx, next) => {
  // Set operation context
  vision.set("operation", "create_order");
  vision.set("user_id", ctx.state.userId);

  // Track business events
  vision.push("events", {
    event: "order_started",
    user_id: ctx.state.userId,
    timestamp: new Date().toISOString(),
  });

  await next();

  // Track completion
  vision.push("events", {
    event: "order_completed",
    order_id: ctx.body.orderId,
    timestamp: new Date().toISOString(),
  });
});

app.use(async (ctx, next) => {
  // Add business context
  vision.merge("business_context", {
    operation: "payment_processing",
    customer_tier: ctx.state.user?.tier,
    payment_method: ctx.request.body?.paymentMethod,
  });

  // Track performance of external calls
  const startTime = Date.now();
  const paymentResult = await processPayment(ctx.request.body);

  vision.push("external_api_calls", {
    service: "payment-gateway",
    duration_ms: Date.now() - startTime,
    success: paymentResult.success,
  });

  ctx.body = { orderId: paymentResult.orderId };
});
```

## 🔍 Context Access

Access the Vision context throughout your middleware stack:

```typescript
// In route handlers
app.use(async (ctx, next) => {
  const visionCtx = ctx.visionContext;
  if (visionCtx) {
    console.log("Context ID:", visionCtx.id);
    console.log("Context Data:", Object.fromEntries(visionCtx.data.entries()));
  }
  await next();
});

// In authentication middleware
app.use(async (ctx, next) => {
  const token = ctx.headers.authorization;
  const user = await authenticate(token);

  if (ctx.visionContext) {
    vision.merge("auth", {
      authenticated: !!user,
      user_id: user?.id,
      auth_method: "bearer_token",
    });
  }

  ctx.state.user = user;
  await next();
});

// In error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (ctx.visionContext) {
      vision.push("error_events", {
        error_type: error.constructor.name,
        error_message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
    throw error;
  }
});
```

## ⚡ Performance Tracking

Automatic performance insights:

```typescript
// Slow operations are automatically detected
app.use(async (ctx, next) => {
  await generateComplexReport(); // Takes 2 seconds
  // Vision automatically marks this as slow_operation: true
  ctx.body = { report: "generated" };
});

// Custom performance tracking
app.use(async (ctx, next) => {
  const dbStart = Date.now();
  const users = await db.users.findMany();

  vision.push("performance", {
    operation: "database.users.findMany",
    duration_ms: Date.now() - dbStart,
    result_count: users.length,
  });

  ctx.body = { users };
});
```

## 🔒 Security & Privacy

Built-in security features:

```typescript
app.use(
  createVisionMiddleware({
    // Automatic sensitive data redaction
    redactSensitiveData: true,
    redactHeaders: ["authorization", "cookie", "x-api-key", "x-auth-token"],
    redactQueryParams: ["token", "password", "secret", "api_key"],
    redactBodyFields: ["password", "ssn", "creditCard", "bankAccount"],

    // Custom error transformation
    errorHandling: {
      transformError: (error, ctx) => ({
        name: error.name,
        message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        // Never expose stack traces in production
        ...(process.env.NODE_ENV !== "production" && {
          stack: error.stack,
        }),
      }),
    },
  }),
);
```

## 📋 TypeScript Support

Full TypeScript integration with enhanced context types:

```typescript
import type { VisionKoaContext } from "@rodrigopsasaki/vision-koa";

// Enhanced context with Vision integration
app.use(async (ctx: VisionKoaContext, next) => {
  // Full type safety
  const visionCtx = ctx.visionContext; // VisionContext | undefined
  const userId = ctx.params?.id; // Fully typed params

  // Vision context is fully typed
  if (visionCtx) {
    visionCtx.data.set("middleware_executed", true);
  }

  await next();
});

// Custom types with Vision context
interface CustomContext extends VisionKoaContext {
  state: {
    user?: { id: string; role: string };
    sessionId?: string;
  };
}

app.use(async (ctx: CustomContext, next) => {
  if (ctx.state.user && ctx.visionContext) {
    vision.set("user_role", ctx.state.user.role);
  }
  await next();
});
```

## 🧪 Testing

Vision-enabled testing utilities:

```typescript
import request from "supertest";
import Koa from "koa";
import { createVisionMiddleware } from "@rodrigopsasaki/vision-koa";

const app = new Koa();
app.use(createVisionMiddleware());

app.use(async (ctx) => {
  ctx.body = { message: "test" };
});

describe("Vision Koa Integration", () => {
  it("should create Vision context", async () => {
    const response = await request(app.callback())
      .get("/test")
      .set("x-correlation-id", "test-correlation-123")
      .expect(200);

    expect(response.headers["x-request-id"]).toBeDefined();
    // You can add custom test exporters to verify context data
  });
});
```

## 🎯 Best Practices

### Production Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

app.use(
  createVisionMiddleware({
    // Conservative settings for production
    captureHeaders: true,
    captureBody: false, // Avoid capturing sensitive data
    captureQuery: !isProduction, // Skip in production for performance

    // Stricter performance thresholds
    performance: {
      slowOperationThreshold: isProduction ? 500 : 1000,
      trackMemoryUsage: false, // Disable for performance
    },

    // Enhanced security
    redactSensitiveData: true,
    errorHandling: {
      captureStackTrace: !isProduction,
    },
  }),
);
```

### Development Configuration

```typescript
app.use(
  createComprehensiveVisionMiddleware({
    // Capture everything for debugging
    captureBody: true,
    captureHeaders: true,
    captureKoaMetadata: true,

    // Detailed error information
    errorHandling: {
      captureStackTrace: true,
      captureErrors: true,
    },

    // Sensitive performance tracking
    performance: {
      trackMemoryUsage: true,
      slowOperationThreshold: 100,
    },
  }),
);
```

### Microservices Setup

```typescript
app.use(
  createVisionMiddleware({
    // Propagate correlation IDs across services
    extractCorrelationId: (ctx) =>
      ctx.headers["x-correlation-id"] || ctx.headers["x-request-id"] || generateRequestId(),

    // Service-specific context naming
    contextNameGenerator: (ctx) => `order-service.${ctx.method.toLowerCase()}.${ctx.path}`,

    // Extract service metadata
    extractMetadata: (ctx) => ({
      service_name: "order-service",
      service_version: process.env.SERVICE_VERSION,
      deployment_env: process.env.NODE_ENV,
    }),
  }),
);
```

## 🔧 Advanced Usage

### Conditional Middleware

```typescript
// Only apply Vision to specific routes
app.use(async (ctx, next) => {
  if (ctx.path.startsWith("/api/")) {
    return createVisionMiddleware()(ctx, next);
  }
  await next();
});
```

### Middleware Composition

```typescript
// Compose with other middleware
app.use(createVisionMiddleware());
app.use(bodyParser());
app.use(cors());
app.use(helmet());

// Vision context is available in all downstream middleware
app.use(async (ctx, next) => {
  if (ctx.visionContext) {
    vision.set("middleware_stack", ["vision", "bodyParser", "cors", "helmet"]);
  }
  await next();
});
```

### Router Integration

```typescript
import Router from "@koa/router";

const router = new Router();

// Vision works seamlessly with koa-router
router.get("/users/:id", async (ctx) => {
  vision.set("user_id", ctx.params.id);
  vision.set("operation", "get_user");

  const user = await getUser(ctx.params.id);
  ctx.body = { user };
});

app.use(createVisionMiddleware());
app.use(router.routes());
app.use(router.allowedMethods());
```

### Error Boundary Integration

```typescript
// Global error handler with Vision integration
app.on("error", (error, ctx) => {
  if (ctx && ctx.visionContext) {
    vision.merge("error_boundary", {
      error_caught_by: "global_error_handler",
      error_type: error.constructor.name,
      timestamp: new Date().toISOString(),
    });
  }

  console.error("Global error:", error);
});
```

## 📦 Package Information

- **Bundle Size**: Minimal footprint, optimized for Koa's simplicity
- **Dependencies**: Only `micromatch` for pattern matching
- **TypeScript**: Full type definitions included
- **Koa Support**: v2.x
- **Node.js**: v18+ recommended

## 🤝 Integration

Works seamlessly with:

- **@koa/router** - Routing
- **@koa/cors** - CORS handling
- **koa-helmet** - Security headers
- **koa-bodyparser** - Request body parsing
- **koa-jwt** - JWT authentication
- **koa-compress** - Response compression
- **koa-static** - Static file serving
- All other Koa middleware

## 📊 Comparison

| Feature       | vision-express | vision-fastify | vision-koa             |
| ------------- | -------------- | -------------- | ---------------------- |
| Philosophy    | Minimal        | Performance    | **Simplicity**         |
| Async Support | Callback       | Promise        | **Native Async/Await** |
| Type Safety   | Good           | Excellent      | **Excellent**          |
| Bundle Size   | Medium         | Small          | **Smallest**           |
| Configuration | Full           | Full           | **Full**               |
| Ecosystem     | Large          | Growing        | **Focused**            |

Perfect for modern APIs, microservices, and applications where simplicity and elegance are paramount! 🧘‍♂️
