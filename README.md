![CI](https://github.com/rodrigopsasaki/vision/actions/workflows/release.yml/badge.svg)
![NPM Version](https://img.shields.io/npm/v/@rodrigopsasaki/vision?logo=npm)
![License](https://img.shields.io/github/license/rodrigopsasaki/vision)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)

# vision

> Structured observability, modeled around intent — not output.

---

## You don't need more logs, you need context.

Vision is a structured observability framework for Node.js that fundamentally changes how you think about production monitoring. Instead of scattered log lines, you get rich, contextual events that tell the complete story of what happened in your application.

### The problem with traditional logging

```typescript
// Traditional approach - scattered, disconnected logs
console.log("processing payment");
console.log("payment amount:", amount);
console.log("payment failed");
console.log("error:", error.message);
```

This produces noise. Four separate log entries, no correlation, no context about the user, the request, or what led to this failure.

### The Vision approach

```typescript
// Vision - one rich, contextual event
await vision.observe("payment.process", async () => {
  vision.set("user_id", user.id);
  vision.set("amount", amount);
  vision.set("currency", "USD");
  
  try {
    const result = await paymentProcessor.charge(amount);
    vision.set("charge_id", result.id);
    vision.set("status", "success");
  } catch (error) {
    vision.set("status", "failed");
    vision.set("error", error.message);
    throw error;
  }
});
```

This produces **one** structured event with complete context:

```json
{
  "name": "payment.process",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "duration": 1250,
  "data": {
    "user_id": "user_123",
    "amount": 99.99,
    "currency": "USD",
    "status": "failed",
    "error": "Card declined"
  }
}
```

## Quick Start

```bash
npm install @rodrigopsasaki/vision
```

Vision works out of the box with zero configuration:

```typescript
import { vision } from "@rodrigopsasaki/vision";

// That's it. Start observing.
await vision.observe("user.signup", async () => {
  vision.set("email", email);
  
  const user = await createUser(email);
  vision.set("user_id", user.id);
  
  await sendWelcomeEmail(user);
  vision.set("welcome_email", "sent");
});
```

## Framework Integrations

Vision provides first-class integrations for popular Node.js frameworks:

### Express.js
```bash
npm install @rodrigopsasaki/vision-express
```

```typescript
import { visionMiddleware } from "@rodrigopsasaki/vision-express";

app.use(visionMiddleware()); // Automatic request tracing

app.post("/api/orders", async (req, res) => {
  vision.set("user_id", req.user.id);
  vision.set("order_total", req.body.total);
  
  const order = await createOrder(req.body);
  res.json(order);
});
```

### Fastify
```bash
npm install @rodrigopsasaki/vision-fastify
```

```typescript
import { visionPlugin } from "@rodrigopsasaki/vision-fastify";

await fastify.register(visionPlugin);
```

### Koa
```bash
npm install @rodrigopsasaki/vision-koa
```

```typescript
import { visionMiddleware } from "@rodrigopsasaki/vision-koa";

app.use(visionMiddleware());
```

### NestJS
```bash
npm install @rodrigopsasaki/vision-nestjs
```

```typescript
import { VisionModule } from "@rodrigopsasaki/vision-nestjs";

@Module({
  imports: [VisionModule.forRoot()],
})
export class AppModule {}
```

## Database Integrations

### Prisma
```bash
npm install @rodrigopsasaki/vision-prisma
```

```typescript
import { instrumentPrisma } from "@rodrigopsasaki/vision-prisma";

// Wrap your Prisma client - all queries are now observable
const prisma = instrumentPrisma(new PrismaClient());

// Automatic tracking of operations, duration, and results
const users = await prisma.user.findMany();
```

### TypeORM
```bash
npm install @rodrigopsasaki/vision-typeorm
```

```typescript
import { VisionSubscriber } from "@rodrigopsasaki/vision-typeorm";

// Register once in your data source
dataSource.subscribers.push(new VisionSubscriber());

// All queries now emit structured events
```

## Production Exporters

### Datadog
```bash
npm install @rodrigopsasaki/vision-datadog-exporter
```

```typescript
import { createDatadogExporter } from "@rodrigopsasaki/vision-datadog-exporter";

vision.init({
  exporters: [
    createDatadogExporter({
      apiKey: process.env.DATADOG_API_KEY,
      service: "api-server",
      environment: "production"
    })
  ]
});
```

## Core Concepts

### Context is King
Vision automatically propagates context through your entire async call stack. No more passing correlation IDs or request context manually.

```typescript
await vision.observe("api.request", async () => {
  vision.set("request_id", req.id);
  
  // This context is available everywhere downstream
  await serviceA.doWork();
});

// In serviceA.ts - no context passing needed!
async function doWork() {
  vision.set("service", "serviceA");
  await serviceB.process();
}

// In serviceB.ts - still have access to everything
async function process() {
  const requestId = vision.get("request_id"); // Original request ID!
  vision.set("processing_complete", true);
}
```

### One Event, Complete Story
Instead of hundreds of log lines, Vision emits one structured event per logical operation with all the context you need.

### Performance First
Vision uses Node.js AsyncLocalStorage for zero-overhead context propagation. The framework is designed to have minimal impact on your application's performance.

## Real-World Example

Here's Vision in a production e-commerce flow:

```typescript
app.post("/checkout", async (req, res) => {
  await vision.observe("checkout.process", async () => {
    vision.set("user_id", req.user.id);
    vision.set("cart_total", req.body.total);
    
    // Validate inventory
    const available = await checkInventory(req.body.items);
    vision.set("inventory_check", available ? "passed" : "failed");
    
    if (!available) {
      throw new Error("Items out of stock");
    }
    
    // Process payment
    const payment = await processPayment(req.body.payment);
    vision.set("payment_id", payment.id);
    vision.set("payment_status", payment.status);
    
    // Create order
    const order = await createOrder({
      userId: req.user.id,
      items: req.body.items,
      paymentId: payment.id
    });
    vision.set("order_id", order.id);
    
    // Send confirmation
    await sendOrderConfirmation(order);
    vision.set("confirmation_sent", true);
    
    res.json({ orderId: order.id });
  });
});
```

This produces one clean event with the complete checkout story - what was ordered, by whom, payment details, and whether it succeeded.

## 📚 Documentation

Visit **[rodrigopsasaki.com/projects/vision](https://rodrigopsasaki.com/projects/vision)** for:

- Complete API reference
- Framework-specific guides
- Production deployment patterns
- Performance optimization tips
- Real-world examples

## Contributing

This is a monorepo managed with [pnpm](https://pnpm.io/) and [Nx](https://nx.dev/). 

```bash
# Clone the repository
git clone https://github.com/rodrigopsasaki/vision.git
cd vision

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run examples
cd examples/express-example
pnpm dev
```

### Development Workflow

We use conventional commits for automated releases:
- `feat:` triggers minor version bump
- `fix:` triggers patch version bump  
- `BREAKING CHANGE:` triggers major version bump

Push to main automatically releases new versions.

## 🙏 Acknowledgments

Special thanks to [Ryan McGrath](https://github.com/zoltrain), the brilliant Go-savvy engineer who first introduced me to the power of propagating structured context across services. This project is a direct descendant of those conversations — just ported to a new ecosystem with the same care for clarity, pragmatism and the value of sharing good ideas.

## License

MIT © [Rodrigo Sasaki](https://github.com/rodrigopsasaki)

