# Vision

A structured observability framework for Node.js applications that treats production monitoring as a first-class citizen, not an afterthought.

## What is Vision?

Vision makes observability **automatic**. Set it up once, and every HTTP request in your application becomes traceable with rich context, timing, and metadata — without changing how you write code.

```typescript
// Setup once in your app
import { vision } from '@rodrigopsasaki/vision';
import { visionMiddleware } from '@rodrigopsasaki/vision-express';

vision.init({
  exporters: [/* your exporters */]
});
app.use(visionMiddleware()); // Every endpoint is now traced

// In your routes, just add data
app.get('/users/:id', async (req, res) => {
  vision.set('user_id', req.params.id);
  vision.set('operation', 'get_user');
  
  const user = await getUser(req.params.id);
  res.json(user);
});
```

When something goes wrong, you get the complete story: what endpoint was called, what data was involved, how long each step took, and exactly where it failed.

## Framework Support

Vision integrates natively with all major Node.js frameworks:

| Framework | Package | Status |
|-----------|---------|--------|
| **Express.js** | [@rodrigopsasaki/vision-express](https://www.npmjs.com/package/@rodrigopsasaki/vision-express) | ✅ Published |
| **Fastify** | [@rodrigopsasaki/vision-fastify](https://www.npmjs.com/package/@rodrigopsasaki/vision-fastify) | ✅ Published |
| **Koa** | [@rodrigopsasaki/vision-koa](https://www.npmjs.com/package/@rodrigopsasaki/vision-koa) | ✅ Published |
| **NestJS** | [@rodrigopsasaki/vision-nestjs](https://www.npmjs.com/package/@rodrigopsasaki/vision-nestjs) | ✅ Published |

## Quick Start

Choose your framework and get started in minutes:

### Express.js
```bash
npm install @rodrigopsasaki/vision @rodrigopsasaki/vision-express
```

### Fastify
```bash
npm install @rodrigopsasaki/vision @rodrigopsasaki/vision-fastify
```

### Koa
```bash
npm install @rodrigopsasaki/vision @rodrigopsasaki/vision-koa
```

### NestJS
```bash
npm install @rodrigopsasaki/vision @rodrigopsasaki/vision-nestjs
```

## Core Packages

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