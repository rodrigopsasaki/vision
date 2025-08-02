# Vision TypeORM Examples

This directory contains comprehensive examples demonstrating how to use the Vision TypeORM integration in various scenarios.

## Examples Overview

### 1. Basic Usage (`basic-usage.ts`)

The simplest way to get started with Vision TypeORM integration.

**Features demonstrated:**

- Zero-configuration setup
- Automatic DataSource instrumentation
- Repository operation observability
- Basic Vision context usage

**Run it:**

```bash
npm run dev examples/basic-usage.ts
```

### 2. Advanced Usage (`advanced-usage.ts`)

Comprehensive example with advanced features and configuration options.

**Features demonstrated:**

- Advanced configuration options
- Security redaction
- Transaction instrumentation with isolation levels
- Decorator-based observability
- Complex query operations
- Error handling and context

**Run it:**

```bash
npm run dev examples/advanced-usage.ts
```

### 3. Performance Optimized (`performance-optimized.ts`)

Production-ready configuration focused on minimal overhead and maximum performance.

**Features demonstrated:**

- Performance-optimized configuration
- Selective instrumentation
- Connection pool monitoring
- Custom performance metrics
- Batch operations
- High-frequency operation handling

**Run it:**

```bash
npm run dev examples/performance-optimized.ts
```

### 4. Microservice Architecture (`microservice-example.ts`)

Distributed system example with correlation IDs and cross-service tracing.

**Features demonstrated:**

- Multiple DataSource instrumentation
- Correlation ID propagation
- Distributed transaction orchestration
- Service-specific configuration
- Workflow observability
- Error handling across services

**Run it:**

```bash
npm run dev examples/microservice-example.ts
```

## Common Patterns

### DataSource Instrumentation

```typescript
import { instrumentDataSource } from "@rodrigopsasaki/vision-typeorm";

const dataSource = new DataSource({
  /* config */
});
const instrumentedDataSource = instrumentDataSource(dataSource);
```

### Transaction Observability

```typescript
import { visionTransaction } from "@rodrigopsasaki/vision-typeorm";

await visionTransaction(dataSource, async (manager) => {
  // All operations here are automatically observed
  const user = await manager.getRepository(User).save(userData);
  return user;
});
```

### Decorator-Based Instrumentation

```typescript
import { VisionInstrumented, VisionObserve } from "@rodrigopsasaki/vision-typeorm";

@VisionInstrumented()
class UserService {
  @VisionObserve()
  async findUser(id: string) {
    // Automatically instrumented
  }
}
```

## Configuration Options

### Basic Configuration

```typescript
const config = {
  enabled: true,
  logParams: false,
  logQuery: true,
  logResultCount: true,
};
```

### Security-First Configuration

```typescript
const config = {
  logParams: true,
  redactFields: ["password", "token", "secret", "ssn", "creditCard"],
  maxQueryLength: 500,
};
```

### Performance Configuration

```typescript
const config = {
  logParams: false,
  logQuery: false,
  logConnectionInfo: false,
  instrumentEntityManager: false,
};
```

## Integration with Vision Core

All examples assume you have Vision core configured with exporters:

```typescript
import { vision } from "@rodrigopsasaki/vision";

vision.init({
  exporters: [
    {
      name: "console",
      success: (ctx) => console.log("Success:", ctx),
      error: (ctx, err) => console.error("Error:", ctx, err),
    },
    // Add your preferred exporters (Datadog, etc.)
  ],
});
```

## Database Setup

Examples use different databases to demonstrate compatibility:

- **SQLite**: Basic examples (no setup required)
- **PostgreSQL**: Advanced examples (requires running PostgreSQL)

### PostgreSQL Setup

```bash
# Using Docker
docker run --name vision-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_USER=user -p 5432:5432 -d postgres

# Create test databases
createdb -h localhost -U user vision_example
createdb -h localhost -U user performance_test
createdb -h localhost -U user customer_service
createdb -h localhost -U user order_service
createdb -h localhost -U user payment_service
```

## Expected Output

Each example produces structured Vision events showing database operations with full context:

```json
{
  "name": "db.user.save",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "database.operation": "save",
    "database.target": "typeorm",
    "database.entity": "User",
    "database.success": true,
    "database.duration_ms": 15,
    "database.result_count": 1
  }
}
```

## Best Practices

1. **Start Simple**: Begin with basic instrumentation and add complexity as needed
2. **Security First**: Always configure `redactFields` for sensitive data
3. **Performance Aware**: Use selective instrumentation in high-traffic scenarios
4. **Correlation IDs**: Implement correlation tracking for distributed systems
5. **Error Handling**: Let Vision capture errors while implementing proper business logic error handling

## Troubleshooting

### Common Issues

1. **Missing Database Operations**: Ensure you're using the instrumented DataSource
2. **Performance Impact**: Reduce logging parameters and query logging for high-frequency operations
3. **Memory Usage**: Set appropriate `maxQueryLength` limits
4. **TypeScript Errors**: Ensure you have the correct TypeORM version as peer dependency

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const config = {
  logParams: true,
  logQuery: true,
  logConnectionInfo: true,
};
```

For more information, see the main README and API documentation.
