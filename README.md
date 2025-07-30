# Vision

> Structured observability, modeled around intent — not output.

A structured observability framework for Node.js applications that treats production monitoring as a first-class citizen, not an afterthought.

## What is Vision?

You don't need more logs, you need **context**.

You need to know:
- What just happened
- What data was involved  
- What the outcome was

But most systems log like this:

```typescript
console.log("starting cart job");
console.log("loaded cart", cart.id);
console.log("charging", cart.total);
console.log("done", { status: "ok" });
```

This tells a story — but it's whispering. No IDs. No continuity. Just bursts of text into the void.

**Vision fixes this by giving you structured context instead of scattered logs.**

## Vision Core - Getting Started

Install the core package first:

```bash
npm install @rodrigopsasaki/vision
```

Vision works without any configuration. Here's your first example:

```typescript
import { vision } from '@rodrigopsasaki/vision';

await vision.observe('cart.process', async () => {
  vision.set('user_id', 'u123');
  vision.set('cart_id', 'c789');
  
  // Your business logic here
  const result = await processCart();
  vision.set('result', result.status);
});
```

That's it. No setup. No boilerplate. Vision runs with a default console exporter out of the box.

This produces a clean canonical event:

```json
{
  "name": "cart.process",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "user_id": "u123",
    "cart_id": "c789", 
    "result": "success"
  }
}
```

## Core Concepts & Examples

### Working with Context

Vision gives you a few simple tools to build rich context:

```typescript
// Set simple values
vision.set('user_id', 'u123');
vision.set('operation', 'checkout');

// Build arrays
vision.push('events', 'cart_loaded');
vision.push('events', 'payment_processed');

// Build objects
vision.merge('metadata', { version: '1.2.3' });
vision.merge('metadata', { region: 'us-east-1' });

// Retrieve values
const userId = vision.get('user_id'); // 'u123'
```

Everything you set is scoped to the active `observe()` block. Accessing context outside that block throws — by design.

### Real-World Example

Here's what Vision looks like in real code:

```typescript
await vision.observe('order.fulfillment', async () => {
  vision.set('user_id', user.id);
  vision.set('order_id', order.id);

  await fulfillOrder(order);
});

// fulfillment.ts - Notice: no context passing needed
async function fulfillOrder(order) {
  await pickItems(order);
  await packItems(order);
  await shipOrder(order);
}

async function pickItems(order) {
  // ...picking logic...
  vision.push('events', 'picked');
}

async function packItems(order) {
  // ...packing logic...
  vision.push('events', 'packed');
  vision.merge('dimensions', { weight: '2.1kg' });
}

async function shipOrder(order) {
  // ...shipping logic...
  vision.push('events', 'shipped');
  vision.merge('shipment', {
    carrier: 'DHL',
    tracking: 'abc123',
  });
}
```

You don't pass context around. You don't log manually. You just describe what happened.

Vision collects it — then emits exactly one event:

```json
{
  "name": "order.fulfillment",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "user_id": "user123",
    "order_id": "ord456",
    "events": ["picked", "packed", "shipped"],
    "dimensions": { "weight": "2.1kg" },
    "shipment": { "carrier": "DHL", "tracking": "abc123" }
  }
}
```

### Custom Exporters

By default, Vision logs to the console. But you can register your own exporters:

```typescript
vision.init({
  exporters: [
    {
      name: 'datadog',
      success: (ctx) => sendToDatadog(ctx),
      error: (ctx, err) => sendErrorToDatadog(ctx, err),
    },
  ],
});
```

## Vision Ecosystem

Vision provides a comprehensive set of integrations to instrument your entire Node.js stack:

### Web Framework Integrations

Automatically create Vision contexts for every HTTP request:

#### Express.js
```bash
npm install @rodrigopsasaki/vision-express
```

```typescript
import { vision } from '@rodrigopsasaki/vision';
import { visionMiddleware } from '@rodrigopsasaki/vision-express';

app.use(visionMiddleware()); // Every endpoint is now traced

app.get('/users/:id', async (req, res) => {
  vision.set('user_id', req.params.id);
  vision.set('operation', 'get_user');
  
  const user = await getUser(req.params.id);
  res.json(user);
});
```

#### Fastify
```bash
npm install @rodrigopsasaki/vision-fastify
```

```typescript
import { visionPlugin } from '@rodrigopsasaki/vision-fastify';

await fastify.register(visionPlugin);

fastify.get('/users/:id', async (request, reply) => {
  vision.set('user_id', request.params.id);
  return getUser(request.params.id);
});
```

#### Koa
```bash
npm install @rodrigopsasaki/vision-koa
```

```typescript
import { visionMiddleware } from '@rodrigopsasaki/vision-koa';

app.use(visionMiddleware());

app.use(async (ctx) => {
  vision.set('user_id', ctx.params.id);
  ctx.body = await getUser(ctx.params.id);
});
```

#### NestJS
```bash
npm install @rodrigopsasaki/vision-nestjs
```

```typescript
import { VisionModule } from '@rodrigopsasaki/vision-nestjs';

@Module({
  imports: [VisionModule.forRoot()],
})
export class AppModule {}

@Controller('users')
export class UsersController {
  @Get(':id')
  async getUser(@Param('id') id: string) {
    vision.set('user_id', id);
    return await this.userService.getUser(id);
  }
}
```

### Data Layer Integrations

Automatic observability for your database operations:

#### Prisma ORM
```bash
npm install @rodrigopsasaki/vision-prisma
```

```typescript
import { PrismaClient } from '@prisma/client';
import { instrumentPrisma } from '@rodrigopsasaki/vision-prisma';

// Just wrap your Prisma client - that's it!
const prisma = instrumentPrisma(new PrismaClient());

// All database operations are now automatically tracked
const users = await prisma.user.findMany();
// Vision captures: operation, duration, result count, success/failure
```

### Exporters

Send your observability data to production monitoring platforms:

#### Datadog
```bash
npm install @rodrigopsasaki/vision-datadog-exporter
```

```typescript
import { vision } from '@rodrigopsasaki/vision';
import { createDatadogExporter } from '@rodrigopsasaki/vision-datadog-exporter';

vision.init({
  exporters: [
    createDatadogExporter({
      apiKey: process.env.DATADOG_API_KEY,
      service: 'my-service',
      environment: 'production',
    }),
  ],
});
```

## Framework Support Status

| Framework | Package | Status |
|-----------|---------|--------|
| **Express.js** | [@rodrigopsasaki/vision-express](https://www.npmjs.com/package/@rodrigopsasaki/vision-express) | ✅ Published |
| **Fastify** | [@rodrigopsasaki/vision-fastify](https://www.npmjs.com/package/@rodrigopsasaki/vision-fastify) | ✅ Published |
| **Koa** | [@rodrigopsasaki/vision-koa](https://www.npmjs.com/package/@rodrigopsasaki/vision-koa) | ✅ Published |
| **NestJS** | [@rodrigopsasaki/vision-nestjs](https://www.npmjs.com/package/@rodrigopsasaki/vision-nestjs) | ✅ Published |

## Monorepo Structure

This monorepo contains:

### Core Framework
- **[@rodrigopsasaki/vision](./packages/vision)** - Core observability framework

### Framework Integrations
- **[@rodrigopsasaki/vision-express](./packages/vision-express)** - Express.js middleware
- **[@rodrigopsasaki/vision-fastify](./packages/vision-fastify)** - Fastify plugin with performance variants
- **[@rodrigopsasaki/vision-koa](./packages/vision-koa)** - Koa async/await middleware
- **[@rodrigopsasaki/vision-nestjs](./packages/vision-nestjs)** - NestJS module with decorators

### Exporters
- **[@rodrigopsasaki/vision-datadog-exporter](./packages/vision-datadog-exporter)** - Production-ready Datadog integration

## Features

✅ **Zero-configuration observability** - Set up once, trace everything  
✅ **Framework-native integration** - Uses each framework's patterns  
✅ **Production-ready exporters** - Built-in circuit breakers, retries, batching  
✅ **Performance variants** - Minimal, comprehensive, and performance-optimized configs  
✅ **Security-conscious** - Automatic sensitive data redaction  
✅ **Microservice-ready** - Service mesh integration, distributed tracing  
✅ **TypeScript-first** - Full type safety with excellent DX  

## 📖 Complete Documentation

**For comprehensive guides, advanced patterns, real-world examples, and detailed API reference, visit:**

## 🌟 **[rodrigopsasaki.com/projects/vision](https://rodrigopsasaki.com/projects/vision)**

The website includes:
- **Framework-specific guides** for Express, Fastify, Koa, and NestJS
- **Performance optimization** techniques and configurations  
- **Microservices patterns** with circuit breakers and service mesh
- **Real-world examples** including authentication flows, e-commerce, and background jobs
- **Production deployment** strategies and best practices
- **Runnable code examples** for every framework and use case

## Contributing

This project follows a monorepo structure with [pnpm workspaces](https://pnpm.io/workspaces). To contribute:

```bash
# Clone and install dependencies
git clone https://github.com/rodrigopsasaki/vision.git
cd vision
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Try the examples
cd packages/vision-fastify/examples
npx tsx basic-usage.ts
```

## 🙏 Acknowledgments

Special thanks to [Ryan McGrath](https://github.com/zoltrain), the brilliant Go-savvy engineer who first introduced me to the power of propagating structured context across services. This project is a direct descendant of those conversations — just ported to a new ecosystem with the same care for clarity, pragmatism and the value of sharing good ideas.

## License

MIT