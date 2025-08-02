# @rodrigopsasaki/vision-typeorm

TypeORM integration for seamless Vision database operation observability.

## Overview

Vision TypeORM provides comprehensive, zero-configuration observability for your TypeORM database operations. It automatically instruments DataSources, Repositories, EntityManagers, and transactions to give you structured insights into your database layer.

## Features

- 🚀 **Zero Configuration**: Works out of the box with sensible defaults
- 🔒 **Security First**: Automatic sensitive data redaction
- ⚡ **Performance Optimized**: Minimal overhead with selective instrumentation
- 🏗️ **Comprehensive Coverage**: DataSource, Repository, EntityManager, QueryRunner, and Transaction instrumentation
- 🎯 **Decorator Support**: Advanced instrumentation with decorators
- 🔍 **Rich Context**: Detailed operation metadata, timing, and error information
- 🌐 **Microservice Ready**: Correlation ID support for distributed tracing

## Installation

```bash
npm install @rodrigopsasaki/vision-typeorm
```

**Peer Dependencies:**

- `@rodrigopsasaki/vision`: ^0.3.0
- `typeorm`: ^0.3.0

## Quick Start

```typescript
import { DataSource } from "typeorm";
import { vision } from "@rodrigopsasaki/vision";
import { instrumentDataSource } from "@rodrigopsasaki/vision-typeorm";

// 1. Initialize your DataSource as usual
const dataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "user",
  password: "password",
  database: "myapp",
  entities: [User, Post],
  synchronize: true,
});

await dataSource.initialize();

// 2. Instrument with Vision (zero configuration!)
const instrumentedDataSource = instrumentDataSource(dataSource);

// 3. Use normally - all operations are automatically observed
await vision.observe("user.create", async () => {
  const userRepository = instrumentedDataSource.getRepository(User);

  const user = await userRepository.save({
    name: "John Doe",
    email: "john@example.com",
  });

  vision.set("user_id", user.id);
  return user;
});
```

**Output:**

```json
{
  "name": "user.create",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "user_id": 1
  }
}

{
  "name": "db.user.save",
  "data": {
    "database.operation": "save",
    "database.target": "typeorm",
    "database.entity": "User",
    "database.success": true,
    "database.duration_ms": 15
  }
}
```

## Core API

### instrumentDataSource(dataSource, config?)

Instruments a TypeORM DataSource with Vision observability.

```typescript
import { instrumentDataSource } from "@rodrigopsasaki/vision-typeorm";

const instrumentedDataSource = instrumentDataSource(dataSource, {
  enabled: true,
  logParams: false,
  logQuery: true,
  logResultCount: true,
  redactFields: ["password", "token", "secret"],
});
```

### instrumentRepository(repository, config?)

Instruments a specific Repository instance.

```typescript
import { instrumentRepository } from "@rodrigopsasaki/vision-typeorm";

const userRepository = dataSource.getRepository(User);
const instrumentedRepository = instrumentRepository(userRepository);
```

### visionTransaction(dataSourceOrManager, transactionFn, config?)

Enhanced transaction wrapper with observability.

```typescript
import { visionTransaction } from "@rodrigopsasaki/vision-typeorm";

const result = await visionTransaction(dataSource, async (manager) => {
  const userRepository = manager.getRepository(User);
  const user = await userRepository.save(userData);

  const postRepository = manager.getRepository(Post);
  const post = await postRepository.save({ ...postData, userId: user.id });

  return { user, post };
});
```

## Configuration Options

```typescript
interface VisionTypeOrmConfig {
  // Core settings
  enabled?: boolean; // Default: true

  // Logging control
  logParams?: boolean; // Default: false (security)
  logQuery?: boolean; // Default: true
  logResultCount?: boolean; // Default: true
  logConnectionInfo?: boolean; // Default: false

  // Performance settings
  maxQueryLength?: number; // Default: 1000

  // Operation naming
  includeEntityInName?: boolean; // Default: true
  operationPrefix?: string; // Default: "db"

  // Security
  redactFields?: string[]; // Default: ["password", "token", "secret", "key", "hash"]

  // Selective instrumentation
  instrumentTransactions?: boolean; // Default: true
  instrumentRepositories?: boolean; // Default: true
  instrumentEntityManager?: boolean; // Default: true
}
```

## Advanced Usage

### Decorator-Based Instrumentation

```typescript
import { VisionInstrumented, VisionObserve, VisionParam } from "@rodrigopsasaki/vision-typeorm";

@VisionInstrumented({ logParams: true })
class UserService {
  constructor(private dataSource: DataSource) {}

  @VisionObserve()
  async createUser(@VisionParam("userData") userData: CreateUserDto) {
    const userRepository = this.dataSource.getRepository(User);
    return await userRepository.save(userData);
  }

  async findUserByEmail(email: string) {
    // This method is automatically instrumented by @VisionInstrumented
    const userRepository = this.dataSource.getRepository(User);
    return await userRepository.findOne({ where: { email } });
  }
}
```

### Transaction with Isolation Level

```typescript
import { visionTransactionWithIsolation } from "@rodrigopsasaki/vision-typeorm";

await visionTransactionWithIsolation(dataSource, "SERIALIZABLE", async (manager) => {
  // Critical operations requiring serializable isolation
  const account = await manager.getRepository(Account).findOne({
    where: { id: accountId },
    lock: { mode: "pessimistic_write" },
  });

  account.balance -= withdrawAmount;
  await manager.getRepository(Account).save(account);

  return account;
});
```

### Manual QueryRunner Management

```typescript
import { visionQueryRunner } from "@rodrigopsasaki/vision-typeorm";

await visionQueryRunner(dataSource, async (queryRunner) => {
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const result = await queryRunner.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
      ["John Doe", "john@example.com"],
    );

    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  }
});
```

## Security Features

### Automatic Data Redaction

Sensitive fields are automatically redacted from logs:

```typescript
const config = {
  logParams: true,
  redactFields: ["password", "token", "creditCard", "ssn"],
};

// Input: { name: "John", password: "secret123", email: "john@example.com" }
// Logged: { name: "John", password: "[REDACTED]", email: "john@example.com" }
```

### Query Truncation

Long queries are automatically truncated to prevent log bloat:

```typescript
const config = {
  maxQueryLength: 200, // Queries longer than 200 chars are truncated
};
```

## Performance Optimization

### Production Configuration

```typescript
const productionConfig = {
  enabled: true,
  logParams: false, // Disable to reduce serialization overhead
  logQuery: false, // Disable in high-frequency scenarios
  logResultCount: true, // Keep for business metrics
  maxQueryLength: 200, // Shorter truncation
  logConnectionInfo: false, // Static information
  instrumentEntityManager: false, // If not using directly
};
```

### Selective Instrumentation

```typescript
// Only instrument specific components
const config = {
  instrumentRepositories: true,
  instrumentEntityManager: false, // Disable if not used
  instrumentTransactions: true,
};
```

## Error Handling

Vision TypeORM automatically captures and structures database errors:

```json
{
  "name": "db.user.save",
  "data": {
    "database.operation": "save",
    "database.success": false,
    "database.error": "duplicate key value violates unique constraint",
    "database.error_details": {
      "code": "23505",
      "constraint": "users_email_unique",
      "table": "users",
      "column": "email"
    },
    "database.duration_ms": 25
  }
}
```

## Microservice Integration

For distributed systems, use correlation IDs to trace operations across services:

```typescript
class CorrelationMiddleware {
  static withCorrelationId<T>(id: string, fn: () => Promise<T>): Promise<T> {
    return vision.observe("service.operation", async () => {
      vision.set("correlation_id", id);
      vision.set("service", "user-service");
      return fn();
    });
  }
}

// Usage
await CorrelationMiddleware.withCorrelationId("req_123", async () => {
  const user = await userService.createUser(userData);
  const profile = await profileService.createProfile(user.id);
  return { user, profile };
});
```

## Examples

See the [`examples/`](./examples/) directory for comprehensive examples:

- **[Basic Usage](./examples/basic-usage.ts)**: Simple setup and usage
- **[Advanced Usage](./examples/advanced-usage.ts)**: Full feature demonstration
- **[Performance Optimized](./examples/performance-optimized.ts)**: Production-ready configuration
- **[Microservice Example](./examples/microservice-example.ts)**: Distributed system patterns

## Integration with Vision Exporters

Vision TypeORM works seamlessly with all Vision exporters:

```typescript
import { vision } from "@rodrigopsasaki/vision";

vision.init({
  exporters: [
    {
      name: "datadog",
      success: (ctx) => {
        // Send to Datadog APM
        sendToDatadog(ctx);
      },
      error: (ctx, err) => {
        // Send errors to error tracking
        sendErrorToDatadog(ctx, err);
      },
    },
  ],
});
```

## TypeScript Support

Full TypeScript support with enhanced types:

```typescript
import type {
  VisionDataSource,
  VisionRepository,
  VisionTypeOrmConfig,
} from "@rodrigopsasaki/vision-typeorm";

// Enhanced types provide full IntelliSense support
const repository: VisionRepository<User> = instrumentRepository(userRepository);
```

## Best Practices

1. **Start Simple**: Begin with default configuration and customize as needed
2. **Security First**: Always configure `redactFields` for sensitive data
3. **Performance Aware**: Disable parameter/query logging in high-frequency operations
4. **Correlation IDs**: Implement request tracing for distributed systems
5. **Error Context**: Let Vision capture errors while implementing proper business error handling
6. **Selective Instrumentation**: Only instrument what you need in performance-critical scenarios

## Troubleshooting

### Performance Impact

- Disable `logParams` and `logQuery` for high-frequency operations
- Use shorter `maxQueryLength` values
- Consider selective instrumentation

### Memory Usage

- Set appropriate `maxQueryLength` limits
- Disable unused instrumentation features

### TypeScript Issues

- Ensure TypeORM peer dependency version compatibility
- Use proper type imports from the package

## Contributing

This is part of the Vision observability framework. For issues, feature requests, or contributions, please visit the [main Vision repository](https://github.com/rodrigopsasaki/vision).

## License

MIT © [Rodrigo Sasaki](https://github.com/rodrigopsasaki)
