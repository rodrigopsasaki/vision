# Vision Prisma Examples

This directory contains comprehensive examples demonstrating how to use `@rodrigopsasaki/vision-prisma` in various scenarios.

## 🚀 Getting Started

### Prerequisites

1. Node.js 16+ installed
2. A PostgreSQL database (or modify `schema.prisma` for your database)
3. Basic familiarity with Prisma ORM

### Setup

1. Create a new project directory:

```bash
mkdir vision-prisma-demo
cd vision-prisma-demo
```

2. Initialize your project:

```bash
npm init -y
npm install @prisma/client @rodrigopsasaki/vision @rodrigopsasaki/vision-prisma
npm install -D prisma typescript @types/node tsx
```

3. Copy the `schema.prisma` file from this examples directory

4. Initialize Prisma:

```bash
npx prisma init
```

5. Update your `.env` file with your database connection:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/vision_demo"
```

6. Push the schema to your database:

```bash
npx prisma db push
```

7. Generate Prisma Client:

```bash
npx prisma generate
```

## 📚 Examples

### 1. Basic Usage (`basic-usage.ts`)

The simplest way to get started with Vision Prisma. Shows:

- Basic instrumentation setup
- Automatic operation tracking
- Simple queries and mutations
- Transaction handling
- Error capture

Run it:

```bash
npx tsx basic-usage.ts
```

### 2. Advanced Usage (`advanced-usage.ts`)

Full-featured example with Express integration. Demonstrates:

- Complete REST API with Vision tracking
- Complex queries with relations
- Pagination and filtering
- Transaction patterns
- Custom context data
- Multiple exporters
- Query event logging

Install additional dependencies:

```bash
npm install express @rodrigopsasaki/vision-express
npm install -D @types/express
```

Run it:

```bash
npx tsx advanced-usage.ts
```

Then try the API:

```bash
# Get all users
curl http://localhost:3000/api/users

# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"secret"}'

# Get user's posts
curl http://localhost:3000/api/users/1/posts

# Get statistics
curl http://localhost:3000/api/stats
```

### 3. Performance Optimized (`performance-optimized.ts`)

Best practices for production use:

- Minimal logging configuration
- Batched metrics export
- Query optimization techniques
- Cursor-based pagination
- Raw queries for complex aggregations
- Connection pooling tips
- Index usage patterns

Run it:

```bash
npx tsx performance-optimized.ts
```

### 4. Microservice Example (`microservice-example.ts`)

Distributed systems patterns:

- Service metadata injection
- Distributed tracing propagation
- Structured JSON logging
- Health checks for orchestration
- Saga pattern for distributed transactions
- Batch operations
- Graceful shutdown

Run it:

```bash
# Run with environment variables
SERVICE_NAME=user-service SERVICE_VERSION=1.2.0 npx tsx microservice-example.ts
```

Test distributed tracing:

```bash
# Send request with trace headers
curl http://localhost:3001/users/1 \
  -H "X-Trace-ID: trace-123" \
  -H "X-Parent-Span-ID: span-456" \
  -H "X-User-ID: user-789"
```

## 🔧 Configuration Options

Vision Prisma provides extensive configuration:

```typescript
const config: VisionPrismaConfig = {
  // Core settings
  enabled: true, // Enable/disable instrumentation
  operationPrefix: "db", // Prefix for operation names

  // Logging control
  logParams: false, // Log query parameters (careful with PII!)
  logQuery: true, // Log SQL queries
  logResultCount: true, // Log result array counts
  logConnectionInfo: false, // Log connection details

  // Performance
  maxQueryLength: 1000, // Truncate long queries

  // Security
  redactFields: [
    // Fields to redact from params
    "password",
    "token",
    "secret",
    "apiKey",
  ],

  // Naming
  includeModelInName: true, // Include model in operation name
};
```

## 🏗️ Architecture Patterns

### Layered Architecture

```typescript
// Repository layer with Vision
class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number) {
    return vision.observe("repo.user.findById", async () => {
      vision.set("user_id", id);
      return this.prisma.user.findUnique({
        where: { id },
      });
    });
  }
}
```

### Service Layer

```typescript
// Service layer adds business context
class UserService {
  async getUser(id: number) {
    return vision.observe("service.user.get", async () => {
      const user = await this.repo.findById(id);
      vision.set("found", !!user);
      return user;
    });
  }
}
```

### API Layer

```typescript
// API layer tracks HTTP context
app.get("/users/:id", async (req, res) => {
  // Vision middleware already tracking HTTP
  const user = await userService.getUser(req.params.id);
  res.json(user);
});
```

## 🎯 Best Practices

1. **Security First**
   - Never log sensitive data (passwords, tokens)
   - Use `redactFields` configuration
   - Disable `logParams` in production

2. **Performance**
   - Use `select` to minimize data transfer
   - Implement cursor pagination for large datasets
   - Batch operations when possible
   - Configure connection pooling

3. **Observability**
   - Use consistent operation naming
   - Add business context with `vision.set()`
   - Track important metrics (counts, IDs)
   - Implement proper error tracking

4. **Testing**
   - Mock Vision in unit tests
   - Use test database for integration tests
   - Verify metrics are captured correctly

## 🔍 Debugging

Enable debug logging:

```bash
DEBUG=prisma:* npx tsx your-script.ts
```

Check Vision context:

```typescript
const ctx = vision.context();
console.log("Current context:", ctx);
```

## 📖 More Resources

- [Vision Documentation](https://github.com/rodrigopsasaki/vision)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vision Prisma API Reference](../README.md)

## 🤝 Contributing

Found an issue or have a suggestion? Please open an issue on the [Vision repository](https://github.com/rodrigopsasaki/vision/issues).
