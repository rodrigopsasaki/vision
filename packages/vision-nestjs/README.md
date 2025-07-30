# @rodrigopsasaki/vision-nestjs

Advanced NestJS integration for Vision observability framework with decorators, guards, dynamic modules, and deep framework integration.

## Features

- 🎯 **Deep NestJS Integration** - Works with HTTP, GraphQL, WebSocket, and Microservice contexts
- 🎨 **Rich Decorators** - `@VisionContext`, `@VisionCapture`, `@VisionSecurity`, `@VisionAudit`, and more
- 🔒 **Security Guard** - Built-in guard for authentication and authorization tracking
- 🏗️ **Dynamic Module** - Async configuration with factory support
- 📊 **Performance Tracking** - Automatic execution time, memory usage, and slow operation detection  
- 🛡️ **Smart Data Redaction** - Automatic sensitive data masking
- 🔧 **Injectable Service** - DI-friendly Vision service with business context methods
- 📡 **Multi-Context Support** - HTTP, GraphQL, WebSocket, and Microservice message tracking
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults

## Installation

```bash
npm install @rodrigopsasaki/vision-nestjs @rodrigopsasaki/vision
```

## Quick Start

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { VisionModule } from '@rodrigopsasaki/vision-nestjs';

@Module({
  imports: [
    VisionModule.forRoot({
      captureRequest: true,
      performance: {
        trackExecutionTime: true,
        slowOperationThreshold: 1000,
      },
    }),
  ],
})
export class AppModule {}
```

### Using Decorators

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { VisionContext, VisionPerformance, VisionSecurity } from '@rodrigopsasaki/vision-nestjs';

@Controller('users')
export class UsersController {
  @Get()
  @VisionContext({ 
    name: 'users.list',
    captureReturn: false 
  })
  async getUsers() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @VisionPerformance('users.get_by_id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post('login')
  @VisionSecurity({
    captureFailures: true,
    captureUserAgent: true,
    captureIpAddress: true,
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
```

### Using the Injectable Service

```typescript
import { Injectable } from '@nestjs/common';
import { VisionService } from '@rodrigopsasaki/vision-nestjs';

@Injectable()
export class UsersService {
  constructor(private readonly visionService: VisionService) {}

  async createUser(userData: CreateUserDto) {
    // Set business context
    this.visionService.setBusinessContext({
      operation: 'user_creation',
      user_type: userData.type,
    });

    try {
      const user = await this.userRepository.create(userData);
      
      // Track success event
      this.visionService.trackEvent('user_created', {
        user_id: user.id,
        created_at: user.createdAt,
      });
      
      return user;
    } catch (error) {
      // Enhanced error tracking
      this.visionService.trackError('user_creation_failed', error, {
        attempted_email: userData.email,
      });
      throw error;
    }
  }

  async getAnalytics(userId: string) {
    return this.visionService.trackPerformance('get_analytics', async () => {
      const analytics = await this.analyticsService.getUser(userId);
      this.visionService.trackMetric('data_points', analytics.length);
      return analytics;
    });
  }
}
```

## Advanced Configuration

### Async Configuration

```typescript
@Module({
  imports: [
    VisionModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        enabled: configService.get('VISION_ENABLED'),
        captureRequest: configService.get('VISION_CAPTURE_REQUEST'),
        performance: {
          trackExecutionTime: true,
          slowOperationThreshold: configService.get('VISION_SLOW_THRESHOLD', 2000),
        },
        extractUser: (context) => {
          const request = context.switchToHttp().getRequest();
          return request.user ? { 
            id: request.user.id, 
            roles: request.user.roles 
          } : undefined;
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### With Security Guard

```typescript
@Module({
  imports: [
    VisionModule.forRoot({
      captureRequest: true,
      redactHeaders: ['authorization', 'cookie'],
      redactBodyFields: ['password', 'token'],
    }, true), // Enable Vision Guard
  ],
})
export class AppModule {}
```

## Decorators Reference

### @VisionContext(config)

Configure Vision context behavior for specific methods or classes.

```typescript
@VisionContext({
  name: 'custom.operation.name',
  scope: 'api',
  captureParams: true,
  captureReturn: false,
  trackPerformance: true,
  initial: { operation_type: 'read' }
})
async getUser(@Param('id') id: string) {
  return this.usersService.findById(id);
}
```

### @VisionCapture(config)

Fine-grained control over what data is captured.

```typescript
@VisionCapture({
  request: true,
  headers: false,
  body: true,
  query: true,
  params: true,
  returns: false,
  customFields: ['ip_address', 'user_agent']
})
async createUser(@Body() createUserDto: CreateUserDto) {
  return this.usersService.create(createUserDto);
}
```

### @VisionSecurity(config)

Enhanced security tracking with automatic redaction.

```typescript
@VisionSecurity({
  captureFailures: true,
  captureUserAgent: true,
  captureIpAddress: true,
})
async sensitiveOperation() {
  // Automatically captures security context while protecting sensitive data
}
```

### @VisionAudit(config)

Comprehensive audit logging for compliance.

```typescript
@VisionAudit({
  operation: 'user_deletion',
  captureActor: true,
  captureTarget: true,
  requiresApproval: false,
})
async deleteUser(@Param('id') userId: string) {
  return this.adminService.deleteUser(userId);
}
```

### @VisionPerformance(name?)

Automatic performance tracking with smart defaults.

```typescript
@VisionPerformance('analytics.generate_report')
async generateReport(@Body() config: ReportConfig) {
  // Automatically tracks execution time and detects slow operations
  return this.analyticsService.generate(config);
}
```

### @VisionIgnore()

Skip Vision context creation for specific methods or classes.

```typescript
@Controller('health')
@VisionIgnore() // Skip entire controller
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

## VisionService API

The injectable `VisionService` provides additional functionality:

### Business Context

```typescript
// Set business-relevant context
visionService.setBusinessContext({
  operation: 'order_processing',
  customer_tier: 'premium',
  region: 'us-east-1',
});
```

### Event Tracking

```typescript
// Track business events
visionService.trackEvent('order_completed', {
  order_id: 'order-123',
  total_amount: 299.99,
  payment_method: 'credit_card',
});
```

### Error Tracking

```typescript
// Enhanced error tracking with categorization
visionService.trackError('payment_processing', error, {
  order_id: 'order-123',
  payment_provider: 'stripe',
  retry_attempt: 2,
});
```

### Performance Tracking

```typescript
// Wrap operations with performance tracking
const result = await visionService.trackPerformance('complex_calculation', async () => {
  return await performComplexCalculation();
});
```

### Metrics

```typescript
// Track custom metrics
visionService.trackMetric('processed_orders', 150, {
  region: 'us-east-1',
  tier: 'premium',
});
```

### External API Tracking

```typescript
// Track external API calls
visionService.trackExternalAPICall(
  'payment-service',
  '/api/v1/charge',
  'POST',
  200,
  150, // response time
  { provider: 'stripe' }
);
```

### Database Operation Tracking

```typescript
// Track database operations
visionService.trackDatabaseOperation(
  'select',
  'users',
  45, // execution time
  100, // rows affected
  { index_usage: 'optimal' }
);
```

## Configuration Options

```typescript
interface VisionNestJSOptions {
  // Basic settings
  enabled?: boolean;
  excludeRoutes?: (string | RegExp)[];
  
  // Data capture
  captureRequest?: boolean;
  captureHeaders?: boolean;
  captureBody?: boolean;
  captureMethodExecution?: boolean;
  
  // Context-specific capture
  captureGraphQLOperation?: boolean;
  captureWebSocketEvents?: boolean;
  captureMicroserviceMessages?: boolean;
  
  // Security
  redactHeaders?: string[];
  redactQueryParams?: string[];
  redactBodyFields?: string[];
  
  // Performance
  performance?: {
    trackExecutionTime?: boolean;
    trackMemoryUsage?: boolean;
    slowOperationThreshold?: number;
  };
  
  // User extraction
  extractUser?: (context: ExecutionContext) => unknown;
  
  // Custom functions
  generateContextName?: (context: ExecutionContext) => string;
  transformError?: (error: unknown, context: ExecutionContext) => Record<string, unknown>;
}
```

## Context Types Support

Vision NestJS automatically detects and handles different execution contexts:

### HTTP Requests
- Automatic request/response metadata capture
- Headers, query parameters, and body extraction
- Response status and timing

### GraphQL Operations
- Operation name, type, and field information
- Variables and query string capture
- Resolver-level context

### WebSocket Events
- Event name and client information
- Connection metadata and handshake details
- Message payload capture

### Microservice Messages
- Message pattern and payload
- Transport-specific metadata
- Request/response correlation

## Integration Examples

### With Authentication Guards

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private visionService: VisionService) {}
  
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isAuthenticated = this.validateToken(request.headers.authorization);
    
    // Add authentication context
    this.visionService.addSecurityContext({
      authentication_success: isAuthenticated,
      user_id: request.user?.id,
    });
    
    return isAuthenticated;
  }
}
```

### With Exception Filters

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private visionService: VisionService) {}
  
  catch(exception: unknown, host: ArgumentsHost) {
    // Track exceptions in Vision context
    if (this.visionService.isInContext()) {
      this.visionService.trackError('unhandled_exception', exception);
    }
    
    // Handle exception...
  }
}
```

### Testing Configuration

```typescript
@Module({
  imports: [
    VisionModule.forTesting({
      enabled: false, // Disable in tests by default
      performance: {
        trackExecutionTime: false,
        slowOperationThreshold: 10000, // Higher threshold for tests
      },
    }),
  ],
})
export class TestAppModule {}
```

## Best Practices

### 1. Use Appropriate Decorators
- `@VisionPerformance` for slow or resource-intensive operations
- `@VisionSecurity` for authentication and authorization endpoints
- `@VisionAudit` for compliance-critical operations
- `@VisionIgnore` for health checks and metrics endpoints

### 2. Configure Data Capture Thoughtfully
- Enable `captureBody` only when necessary and safe
- Always configure `redactHeaders` and `redactBodyFields` for security
- Use `captureReturn: false` for endpoints returning sensitive data

### 3. Leverage the Vision Service
- Use business context methods to add domain-specific information
- Track custom metrics for business KPIs
- Use performance tracking for optimization insights

### 4. Environment-Specific Configuration
- Disable or limit data capture in production
- Use async configuration for environment-based settings
- Configure appropriate slow operation thresholds

### 5. Security Considerations
- Never capture passwords, tokens, or API keys
- Use the security guard for enhanced monitoring
- Configure appropriate redaction patterns
- Be mindful of GDPR and privacy requirements

## Advanced Features

### Child Contexts
```typescript
async processOrder(orderId: string) {
  return this.visionService.withChildContext('order.payment', async () => {
    // Process payment in isolated context
    return this.paymentService.charge(orderId);
  });
}
```

### Custom Context Names
```typescript
VisionModule.forRoot({
  generateContextName: (context) => {
    const method = context.switchToHttp().getRequest().method;
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    return `api.${method.toLowerCase()}.${controller}.${handler}`;
  },
})
```

### Error Transformation
```typescript
VisionModule.forRoot({
  transformError: (error, context) => ({
    error_type: error.constructor.name,
    error_message: error.message,
    controller: context.getClass().name,
    handler: context.getHandler().name,
    timestamp: new Date().toISOString(),
  }),
})
```

## License

MIT