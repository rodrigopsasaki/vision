# @rodrigopsasaki/vision-prisma

Automatic database operation observability for Prisma with zero configuration required.

## Installation

```bash
npm install @rodrigopsasaki/vision-prisma @rodrigopsasaki/vision @prisma/client
```

## Quick Start

The simplest way to add Vision observability to your Prisma operations:

```typescript
import { PrismaClient } from "@prisma/client";
import { instrumentPrisma } from "@rodrigopsasaki/vision-prisma";
import { vision } from "@rodrigopsasaki/vision";

// Create and instrument your Prisma client
const prisma = instrumentPrisma(new PrismaClient());

// Use Prisma normally - Vision automatically captures everything
await vision.observe("user.signup", async () => {
  const user = await prisma.user.create({
    data: {
      email: "user@example.com",
      name: "John Doe",
    },
  });

  // Vision automatically captures:
  // - Operation: db.user.create
  // - Duration: 45ms
  // - Success/failure status
  // - Result count (for queries)

  vision.set("user_id", user.id);
  return user;
});
```

## Configuration

Customize the instrumentation behavior:

```typescript
import { instrumentPrisma } from "@rodrigopsasaki/vision-prisma";

const prisma = instrumentPrisma(new PrismaClient(), {
  // Enable/disable instrumentation
  enabled: true,

  // Log query parameters (disabled by default for security)
  logParams: false,

  // Log the actual SQL query
  logQuery: true,

  // Include result count for find operations
  logResultCount: true,

  // Truncate long queries to prevent log bloat
  maxQueryLength: 1000,

  // Include model name in operation name (e.g., "db.user.create" vs "db.create")
  includeModelInName: true,

  // Custom operation name prefix
  operationPrefix: "database",

  // Fields to redact from parameters (case-insensitive)
  redactFields: ["password", "token", "secret", "key", "hash"],

  // Include database connection info
  logConnectionInfo: false,
});
```

## Advanced Usage

### Query Event Logging

For enhanced observability including raw SQL queries:

```typescript
import { instrumentPrismaWithQueryLogging } from "@rodrigopsasaki/vision-prisma";

const prisma = instrumentPrismaWithQueryLogging(new PrismaClient(), {
  logQuery: true,
  logParams: true, // Be careful with sensitive data
  maxQueryLength: 2000,
});
```

### Custom Context Names

Vision automatically generates operation names, but you can create custom contexts:

```typescript
await vision.observe("user.complex-workflow", async () => {
  // Multiple database operations within one context
  const user = await prisma.user.findUnique({ where: { id: 1 } });
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });

  // All operations are captured under "user.complex-workflow"
});
```

### Error Handling

Database errors are automatically captured:

```typescript
await vision.observe("user.lookup", async () => {
  try {
    return await prisma.user.findUniqueOrThrow({ where: { id: 999 } });
  } catch (error) {
    // Vision automatically captures:
    // - database.success: false
    // - database.error: "Record not found"
    // - Operation duration
    throw error;
  }
});
```

## Captured Data

Vision-Prisma automatically captures:

- **Operation Metadata**
  - `database.operation`: The Prisma method called (e.g., "user.create")
  - `database.target`: Always "prisma"
  - `database.model`: The Prisma model name (if applicable)

- **Performance Metrics**
  - `database.duration_ms`: Total operation duration
  - `database.query_duration_ms`: SQL query execution time (with query logging)

- **Results**
  - `database.success`: Boolean indicating success/failure
  - `database.result_count`: Number of records returned (for queries)
  - `database.error`: Error message (on failure)

- **Query Details** (with `logQuery: true`)
  - `database.query`: The SQL query executed
  - `database.query_params`: Query parameters (redacted by default)
  - `database.query_timestamp`: When the query was executed

- **Parameters** (with `logParams: true`)
  - `database.params`: The arguments passed to the Prisma method (redacted)

## Security

By default, Vision-Prisma prioritizes security:

- **No parameter logging**: Query parameters are not logged by default
- **Automatic redaction**: Sensitive fields are automatically redacted
- **Query truncation**: Long queries are truncated to prevent log bloat
- **Configurable field redaction**: Customize which fields to redact

## Integration with Other Vision Packages

Vision-Prisma works seamlessly with other Vision integrations:

```typescript
import express from "express";
import { visionMiddleware } from "@rodrigopsasaki/vision-express";
import { instrumentPrisma } from "@rodrigopsasaki/vision-prisma";

const app = express();
const prisma = instrumentPrisma(new PrismaClient());

// Vision context flows through the entire request
app.use(visionMiddleware());

app.get("/users/:id", async (req, res) => {
  // This automatically runs within the HTTP request context
  const user = await prisma.user.findUnique({
    where: { id: parseInt(req.params.id) },
  });

  res.json(user);

  // Vision captures both HTTP request and database operation data
});
```

## TypeScript Support

Full TypeScript support with proper type inference:

```typescript
import { PrismaClient } from "@prisma/client";
import { instrumentPrisma, VisionPrismaConfig } from "@rodrigopsasaki/vision-prisma";

const config: VisionPrismaConfig = {
  logParams: true,
  redactFields: ["password", "secretKey"],
};

const prisma = instrumentPrisma(new PrismaClient(), config);

// Full type safety maintained
const user = await prisma.user.create({
  data: {
    email: "test@example.com", // TypeScript knows this is required
    name: "Test User",
  },
});
```

## License

MIT
