# @rodrigopsasaki/vision-nestjs

NestJS integration for Vision observability framework with automatic context capture, decorators, and guards.

## Features

- 🎯 **Automatic Context Capture** - Automatically captures HTTP, GraphQL, WebSocket, and Microservice metadata
- 🎨 **Configuration Decorators** - `@VisionContext`, `@VisionCapture`, `@VisionSecurity`, `@VisionAudit`, `@VisionPerformance`
- 🔒 **Security Guard** - Optional guard for enhanced monitoring and audit logging
- 🏗️ **Dynamic Module** - Sync and async configuration with factory support
- 📊 **Performance Tracking** - Automatic execution time and memory usage tracking
- 🛡️ **Smart Data Redaction** - Configurable sensitive data masking
- 📡 **Multi-Context Support** - Works seamlessly with all NestJS execution contexts
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
import { vision } from '@rodrigopsasaki/vision';

@Controller('users')
export class UsersController {
  @Get()
  @VisionContext({ 
    name: 'users.list',
    captureReturn: false 
  })
  async getUsers() {
    // The interceptor automatically creates a Vision context
    // You can add custom data using the core Vision API
    vision.set('operation', 'list_users');
    vision.set('data_access_level', 'public');
    
    return this.usersService.findAll();
  }

  @Get(':id')
  @VisionPerformance('users.get_by_id')
  async getUser(@Param('id') id: string) {
    // Add custom context data
    vision.set('requested_user_id', id);
    vision.set('access_level', 'authenticated');

    return this.usersService.findById(id);
  }

  @Post('login')
  @VisionSecurity({
    captureFailures: true,
    captureUserAgent: true,
    captureIpAddress: true,
  })
  async login(@Body() loginDto: LoginDto) {
    // Security decorator automatically captures security-relevant data
    return this.authService.login(loginDto);
  }
}
```

### Using Vision in Services

```typescript
import { Injectable } from '@nestjs/common';
import { vision } from '@rodrigopsasaki/vision';

@Injectable()
export class UsersService {
  async createUser(userData: CreateUserDto) {
    // Set business context
    vision.merge('business_context', {
      operation: 'user_creation',
      user_type: userData.type,
    });

    try {
      const user = await this.userRepository.create(userData);
      
      // Track success event
      vision.push('events', {
        event: 'user_created',
        user_id: user.id,
        timestamp: new Date().toISOString(),
      });
      
      return user;
    } catch (error) {
      // Track error
      vision.merge('error', {
        type: 'user_creation_failed',
        message: error.message,
        attempted_email: userData.email,
      });
      throw error;
    }
  }

  async findAll() {
    const startTime = Date.now();
    
    try {
      const users = await this.userRepository.find();
      
      // Track performance
      vision.push('performance', {
        operation: 'users.findAll',
        duration_ms: Date.now() - startTime,
        result_count: users.length,
      });
      
      return users;
    } catch (error) {
      vision.push('performance', {
        operation: 'users.findAll',
        duration_ms: Date.now() - startTime,
        error: error.message,
      });
      throw error;
    }
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

The injectable `VisionService` provides convenient access to Vision:

```typescript
import { Injectable } from '@nestjs/common';
import { VisionService } from '@rodrigopsasaki/vision-nestjs';

@Injectable()
export class MyService {
  constructor(private readonly visionService: VisionService) {}

  doSomething() {
    // Check if in Vision context
    if (this.visionService.isInContext()) {
      // Access the vision instance directly
      const vision = this.visionService.vision;
      
      // Use any core Vision API methods
      vision.set('key', 'value');
      vision.push('events', { event: 'something_happened' });
      vision.merge('metadata', { additional: 'data' });
    }
  }
}
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
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isAuthenticated = this.validateToken(request.headers.authorization);
    
    // Add authentication context using core Vision API
    vision.merge('security', {
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
  catch(exception: unknown, host: ArgumentsHost) {
    // Track exceptions in Vision context
    vision.merge('error', {
      type: 'unhandled_exception',
      message: exception instanceof Error ? exception.message : String(exception),
      timestamp: new Date().toISOString(),
    });
    
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

### 1. Use Core Vision API
- Always use the core Vision API (`vision.set`, `vision.push`, `vision.merge`) for adding custom data
- The package focuses on automatic metadata collection from NestJS
- Don't create package-specific abstractions over Vision

### 2. Use Appropriate Decorators
- `@VisionPerformance` for slow or resource-intensive operations
- `@VisionSecurity` for authentication and authorization endpoints
- `@VisionAudit` for compliance-critical operations
- `@VisionIgnore` for health checks and metrics endpoints

### 3. Configure Data Capture Thoughtfully
- Enable `captureBody` only when necessary and safe
- Always configure `redactHeaders` and `redactBodyFields` for security
- Use `captureReturn: false` for endpoints returning sensitive data

### 4. Environment-Specific Configuration
- Disable or limit data capture in production
- Use async configuration for environment-based settings
- Configure appropriate slow operation thresholds

### 5. Security Considerations
- Never capture passwords, tokens, or API keys
- Use the security guard for enhanced monitoring
- Configure appropriate redaction patterns
- Be mindful of GDPR and privacy requirements

## Philosophy

This package follows the same philosophy as other Vision integration packages:

1. **Use Core Vision API** - No custom methods that duplicate or wrap Vision's functionality
2. **Automatic Metadata Collection** - Focus on automatically capturing NestJS-specific metadata
3. **Zero Learning Curve** - Users only need to know the core Vision API
4. **Configuration Over Code** - Decorators and module options control behavior
5. **Framework Integration** - Deep integration with NestJS patterns and conventions

The package handles the complexity of extracting metadata from various NestJS contexts while keeping the API surface minimal and consistent with Vision core.

## License

MIT