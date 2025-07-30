# 🎯 @rodrigopsasaki/vision-fastify

High-performance **Fastify plugin** for seamless [Vision](https://github.com/rodrigopsasaki/vision) context integration. Built for speed, designed for observability.

## ✨ Features

- 🚀 **Zero-overhead observability** - Optimized for Fastify's performance
- 🎯 **Automatic context creation** - Every request gets a Vision context
- ⚡ **Performance tracking** - Built-in slow operation detection  
- 🔒 **Security-aware** - Intelligent sensitive data redaction
- 🎨 **Highly configurable** - From minimal to comprehensive tracking
- 🔌 **Plugin ecosystem ready** - Works with all Fastify plugins
- 📊 **Rich metadata capture** - Headers, body, query, params, and more
- 🏗️ **TypeScript first** - Full type safety and IntelliSense

## 🚀 Quick Start

```bash
npm install @rodrigopsasaki/vision @rodrigopsasaki/vision-fastify
```

```typescript
import Fastify from 'fastify';
import { visionPlugin } from '@rodrigopsasaki/vision-fastify';

const fastify = Fastify();

// Register the Vision plugin
await fastify.register(visionPlugin);

fastify.get('/users/:id', async (request, reply) => {
  // Vision context is automatically available
  vision.set('user_id', request.params.id);
  vision.set('operation', 'get_user');
  
  const user = await getUser(request.params.id);
  return user;
});

await fastify.listen({ port: 3000 });
```

## 🎛️ Configuration Options

### Basic Configuration

```typescript
await fastify.register(visionPlugin, {
  // Data capture options
  captureHeaders: true,
  captureBody: false,      // Be careful in production
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
  redactHeaders: ['authorization', 'cookie'],
  redactQueryParams: ['token', 'password'],
  redactBodyFields: ['password', 'ssn'],
});
```

### Advanced Configuration

```typescript
await fastify.register(visionPlugin, {
  // Custom extractors
  extractUser: (request) => ({
    id: request.headers['x-user-id'],
    role: request.headers['x-user-role'],
  }),
  
  extractCorrelationId: (request) => 
    request.headers['x-correlation-id'] ||
    request.headers['x-request-id'],
  
  extractMetadata: (request) => ({
    client_version: request.headers['x-client-version'],
    feature_flags: request.headers['x-feature-flags']?.split(','),
  }),
  
  // Custom context naming
  contextNameGenerator: (request) => 
    `api.${request.method.toLowerCase()}.${request.routeOptions?.url}`,
  
  // Route exclusion
  excludeRoutes: ['/health', '/metrics', '/docs/*'],
  shouldExcludeRoute: (request) => request.url.startsWith('/internal/'),
});
```

## 🎨 Pre-configured Plugins

### Minimal Plugin (Performance Optimized)
```typescript
import { createMinimalVisionPlugin } from '@rodrigopsasaki/vision-fastify';

await fastify.register(createMinimalVisionPlugin({
  performance: { slowOperationThreshold: 100 }
}));
```

### Comprehensive Plugin (Full Observability)
```typescript
import { createComprehensiveVisionPlugin } from '@rodrigopsasaki/vision-fastify';

await fastify.register(createComprehensiveVisionPlugin({
  captureBody: true,
  performance: { trackMemoryUsage: true }
}));
```

### Performance Plugin (Ultra-fast)
```typescript
import { createPerformanceVisionPlugin } from '@rodrigopsasaki/vision-fastify';

await fastify.register(createPerformanceVisionPlugin());
```

## 🏗️ Route-Level Configuration

Override plugin settings for specific routes:

```typescript
fastify.get('/sensitive-endpoint', {
  config: {
    vision: {
      captureBody: false,
      redactHeaders: ['authorization', 'x-api-key', 'custom-token']
    }
  }
}, async (request, reply) => {
  // Route-specific Vision configuration applies
  return { sensitive: 'data' };
});
```

## 📊 Vision API Usage

Use the full power of Vision's API within your handlers:

```typescript
fastify.post('/orders', async (request, reply) => {
  // Set operation context
  vision.set('operation', 'create_order');
  vision.set('user_id', request.body.userId);
  
  // Track business events
  vision.push('events', {
    event: 'order_created',
    order_id: newOrder.id,
    amount: newOrder.total,
    timestamp: new Date().toISOString(),
  });
  
  // Add business context
  vision.merge('business_context', {
    operation: 'order_processing',
    customer_tier: user.tier,
    payment_method: request.body.paymentMethod,
  });
  
  // Track performance of external calls
  const startTime = Date.now();
  const paymentResult = await processPayment(order);
  
  vision.push('external_api_calls', {
    service: 'payment-gateway',
    duration_ms: Date.now() - startTime,
    success: paymentResult.success,
  });
  
  return { orderId: newOrder.id, status: 'created' };
});
```

## 🔍 Context Access

Access the Vision context from anywhere in your request lifecycle:

```typescript
// In route handlers
fastify.get('/users/:id', async (request, reply) => {
  const ctx = request.visionContext;
  console.log('Context ID:', ctx.id);
  console.log('Context Data:', Object.fromEntries(ctx.data.entries()));
});

// In hooks
fastify.addHook('preHandler', async (request, reply) => {
  if (request.visionContext) {
    vision.set('pre_handler_executed', true);
  }
});

// In plugins
fastify.register(async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Add plugin-specific metadata
    vision.set('plugin_name', 'my-custom-plugin');
  });
});
```

## ⚡ Performance Tracking

Automatic performance insights:

```typescript
// Slow operations are automatically detected
fastify.get('/slow-analytics', async (request, reply) => {
  await generateComplexAnalytics(); // Takes 2 seconds
  // Vision automatically marks this as slow_operation: true
  return analytics;
});

// Custom performance tracking
fastify.get('/custom-timing', async (request, reply) => {
  const dbStart = Date.now();
  const users = await db.users.findMany();
  
  vision.push('performance', {
    operation: 'database.users.findMany',
    duration_ms: Date.now() - dbStart,
    result_count: users.length,
  });
  
  return users;
});
```

## 🔒 Security & Privacy

Built-in security features:

```typescript
await fastify.register(visionPlugin, {
  // Automatic sensitive data redaction
  redactSensitiveData: true,
  redactHeaders: [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token'
  ],
  redactQueryParams: [
    'token',
    'password',
    'secret',
    'api_key'
  ],
  redactBodyFields: [
    'password',
    'ssn',
    'creditCard',
    'bankAccount'
  ],
  
  // Custom error transformation
  errorHandling: {
    transformError: (error, request) => ({
      name: error.name,
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      // Never expose stack traces in production
      ...(process.env.NODE_ENV !== 'production' && { 
        stack: error.stack 
      }),
    }),
  },
});
```

## 📋 TypeScript Support

Full TypeScript integration with enhanced request/reply types:

```typescript
import type { VisionFastifyRequest, VisionFastifyReply } from '@rodrigopsasaki/vision-fastify';

// Enhanced request with Vision context
fastify.get('/users/:id', async (request: VisionFastifyRequest, reply: VisionFastifyReply) => {
  // Full type safety
  const ctx = request.visionContext; // VisionContext | undefined
  const userId = request.params.id;   // Fully typed params
  
  // Vision context is available on both request and reply
  reply.visionContext?.data.set('response_prepared', true);
  
  return { user: { id: userId } };
});
```

## 🧪 Testing

Vision-enabled testing utilities:

```typescript
import { test } from 'tap';
import { build } from './helper'; // Your Fastify test helper

test('Vision context in tests', async (t) => {
  const app = await build(t);
  
  const response = await app.inject({
    method: 'GET',
    url: '/users/123',
    headers: {
      'x-correlation-id': 'test-correlation-123'
    }
  });
  
  t.equal(response.statusCode, 200);
  t.ok(response.headers['x-request-id']); // Vision adds request ID
  
  // Verify Vision context was created
  // (You can add custom test exporters to verify context data)
});
```

## 🎯 Best Practices

### Production Configuration
```typescript
const isProduction = process.env.NODE_ENV === 'production';

await fastify.register(visionPlugin, {
  // Conservative settings for production
  captureHeaders: true,
  captureBody: false,              // Avoid capturing sensitive data
  captureQuery: !isProduction,    // Skip in production for performance
  
  // Stricter performance thresholds
  performance: {
    slowOperationThreshold: isProduction ? 500 : 1000,
    trackMemoryUsage: false,       // Disable for performance
  },
  
  // Enhanced security
  redactSensitiveData: true,
  errorHandling: {
    captureStackTrace: !isProduction,
  },
});
```

### Development Configuration
```typescript
await fastify.register(createComprehensiveVisionPlugin({
  // Capture everything for debugging
  captureBody: true,
  captureHeaders: true,
  
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
}));
```

### Microservices Setup
```typescript
await fastify.register(visionPlugin, {
  // Propagate correlation IDs across services
  extractCorrelationId: (request) =>
    request.headers['x-correlation-id'] ||
    request.headers['x-request-id'] ||
    generateRequestId(),
  
  // Service-specific context naming
  contextNameGenerator: (request) =>
    `user-service.${request.method.toLowerCase()}.${request.routeOptions?.url}`,
  
  // Extract service metadata
  extractMetadata: (request) => ({
    service_name: 'user-service',
    service_version: process.env.SERVICE_VERSION,
    deployment_env: process.env.NODE_ENV,
  }),
});
```

## 🔧 Advanced Usage

### Multiple Vision Instances
```typescript
// Register multiple plugins with different configurations
await fastify.register(visionPlugin, { name: 'main-vision' });
await fastify.register(createMinimalVisionPlugin(), { name: 'minimal-vision' });
```

### Custom Hooks Integration
```typescript
fastify.addHook('preHandler', async (request, reply) => {
  if (request.visionContext) {
    // Add authentication context
    vision.merge('auth', {
      authenticated: !!request.headers.authorization,
      auth_method: getAuthMethod(request),
    });
  }
});

fastify.addHook('onError', async (request, reply, error) => {
  if (request.visionContext) {
    // Add error context
    vision.push('error_events', {
      error_type: error.constructor.name,
      error_code: error.code,
      timestamp: new Date().toISOString(),
    });
  }
});
```

## 📦 Package Information

- **Bundle Size**: Minimal footprint, optimized for Fastify's performance
- **Dependencies**: Only `fastify-plugin` and `micromatch`
- **TypeScript**: Full type definitions included
- **Fastify Support**: v4.x and v5.x
- **Node.js**: v18+ recommended

## 🤝 Integration

Works seamlessly with:
- **@fastify/cors** - CORS handling
- **@fastify/helmet** - Security headers  
- **@fastify/rate-limit** - Rate limiting
- **@fastify/jwt** - JWT authentication
- **@fastify/swagger** - API documentation
- **@fastify/multipart** - File uploads
- All other Fastify plugins

## 📊 Comparison

| Feature | vision-express | vision-fastify | vision-nestjs |
|---------|---------------|----------------|---------------|
| Performance | Good | **Excellent** | Good |
| Plugin System | Middleware | **Native Plugin** | Decorator |
| Type Safety | Good | **Excellent** | **Excellent** |
| Route Config | Limited | **Full Support** | **Full Support** |
| Async Hooks | Manual | **Automatic** | **Automatic** |

Perfect for high-performance APIs, microservices, and production applications where speed and observability are critical! 🚀