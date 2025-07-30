import { vision } from "@rodrigopsasaki/vision";
import { Controller, Get, Injectable, Module, Post, Body, Param } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import {
  VisionModule,
  VisionService,
  VisionContext,
  VisionCapture,
  VisionPerformance,
  VisionSecurity,
} from "../src";

// DTO for demonstration
class CreateUserDto {
  email: string;
  password: string;
  name: string;
}

// Service with Vision integration
@Injectable()
export class UsersService {
  constructor(private readonly visionService: VisionService) {}

  async findAll() {
    // Track business context using core Vision API
    vision.merge("business_context", {
      operation: "list_users",
      data_access_level: "public",
    });

    // Track database operation
    const startTime = Date.now();
    try {
      // Simulate slow database query
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const users = [
        { id: 1, name: "John Doe", email: "john@example.com" },
        { id: 2, name: "Jane Smith", email: "jane@example.com" },
      ];

      // Track metrics
      vision.push("metrics", {
        metric: "users_returned",
        value: users.length,
        timestamp: new Date().toISOString(),
      });

      // Track performance
      vision.push("performance", {
        operation: "database.users.findAll",
        duration_ms: Date.now() - startTime,
        success: true,
      });
      
      return users;
    } catch (error) {
      vision.push("performance", {
        operation: "database.users.findAll",
        duration_ms: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string) {
    // Set business context for this operation
    vision.merge("business_context", {
      operation: "get_user_by_id",
      user_id: id,
      data_access_level: "private",
    });

    try {
      // Simulate external API call
      const startTime = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const responseTime = Date.now() - startTime;

      // Track external API call
      vision.push("external_api_calls", {
        service: "users-service",
        endpoint: `/users/${id}`,
        method: "GET",
        status_code: 200,
        duration_ms: responseTime,
        cache_hit: false,
        timestamp: new Date().toISOString(),
      });

      const user = { id: parseInt(id), name: "John Doe", email: "john@example.com" };
      
      // Track successful retrieval
      vision.push("events", {
        event: "user_retrieved",
        user_id: id,
        user_email: user.email,
        timestamp: new Date().toISOString(),
      });

      return user;
    } catch (error) {
      // Track error with context
      vision.merge("error", {
        type: "user_retrieval_failed",
        message: error instanceof Error ? error.message : String(error),
        user_id: id,
        context: "database_query",
      });
      throw error;
    }
  }

  async create(createUserDto: CreateUserDto) {
    // Set business context
    vision.merge("business_context", {
      operation: "create_user",
      user_email: createUserDto.email,
      registration_source: "api",
    });

    try {
      // Simulate user creation with database tracking
      const startTime = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const executionTime = Date.now() - startTime;

      // Track database operation
      vision.push("database_operations", {
        operation: "insert",
        table: "users",
        duration_ms: executionTime,
        rows_affected: 1,
        table_size_before: 1000,
        timestamp: new Date().toISOString(),
      });

      const user = {
        id: Math.floor(Math.random() * 1000),
        name: createUserDto.name,
        email: createUserDto.email,
        createdAt: new Date(),
      };

      // Track successful creation
      vision.push("events", {
        event: "user_created",
        user_id: user.id,
        user_email: user.email,
        registration_timestamp: user.createdAt.toISOString(),
      });

      return user;
    } catch (error) {
      vision.merge("error", {
        type: "user_creation_failed",
        message: error instanceof Error ? error.message : String(error),
        user_email: createUserDto.email,
        validation_passed: true,
      });
      throw error;
    }
  }
}

// Controller with various Vision decorators
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @VisionContext({
    name: "api.users.list",
    scope: "public_api",
    captureReturn: false, // Don't capture user data in response
  })
  @VisionCapture({
    request: true,
    query: true,
    headers: false, // Don't capture potentially sensitive headers
  })
  async getUsers() {
    // Vision context is automatically created and will include:
    // - Request metadata (method, path, query params)
    // - Performance metrics
    // - Business context from the service
    return this.usersService.findAll();
  }

  @Get(":id")
  @VisionPerformance("api.users.get_by_id") // Enables performance tracking
  async getUser(@Param("id") id: string) {
    // Manually add context data using core Vision API
    vision.set("requested_user_id", id);
    vision.set("access_level", "authenticated");

    return this.usersService.findById(id);
  }

  @Post()
  @VisionSecurity({ // Security-focused tracking
    captureFailures: true,
    captureUserAgent: true,
    captureIpAddress: true,
  })
  async createUser(@Body() createUserDto: CreateUserDto) {
    // Security decorator automatically captures:
    // - IP address and user agent
    // - Failure tracking
    // - Security-relevant context
    // - Redacts sensitive data automatically

    return this.usersService.create(createUserDto);
  }
}

// Health check controller with Vision ignored
@Controller("health")
export class HealthController {
  @Get()
  @VisionContext({ name: "health.check" }) // Simple context for health checks
  @VisionCapture({ request: false, headers: false }) // Minimal data capture
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}

// Main application module
@Module({
  imports: [
    // Initialize Vision with comprehensive configuration
    VisionModule.forRoot({
      // Basic configuration
      enabled: true,
      captureRequest: true,
      captureMethodExecution: true,

      // Exclude noisy endpoints
      excludeRoutes: ["/favicon.ico", "/metrics"],

      // Smart user extraction (works with Passport, JWT, etc.)
      extractUser: (context) => {
        try {
          const request = context.switchToHttp().getRequest();
          return request.user ? {
            id: request.user.id || request.user.sub,
            email: request.user.email,
            roles: request.user.roles || [],
          } : undefined;
        } catch {
          return undefined;
        }
      },

      // Performance tracking
      performance: {
        trackExecutionTime: true,
        trackMemoryUsage: false, // Disabled for demo
        slowOperationThreshold: 1000, // 1 second
      },

      // Security settings
      redactHeaders: ["authorization", "cookie", "x-api-key"],
      redactQueryParams: ["token", "api_key"],
      redactBodyFields: ["password", "token", "secret"],

      // Response headers
      includeRequestId: true,
      requestIdHeader: "x-vision-request-id",
    }),
  ],
  controllers: [UsersController, HealthController],
  providers: [UsersService],
})
export class AppModule {}

// Bootstrap application
async function bootstrap() {
  // Initialize Vision with exporters before creating the app
  vision.init({
    exporters: [
      // Add your exporters here
      {
        name: "console-demo",
        success: (ctx) => {
          console.log("🎯 Vision Context (Success):", {
            id: ctx.id,
            name: ctx.name,
            data: Object.fromEntries(ctx.data.entries()),
          });
        },
        error: (ctx, error) => {
          console.error("❌ Vision Context (Error):", {
            id: ctx.id,
            name: ctx.name,
            error: error instanceof Error ? error.message : String(error),
            data: Object.fromEntries(ctx.data.entries()),
          });
        },
      },
    ],
  });

  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for demo
  app.enableCors();
  
  await app.listen(3000);
  
  console.log("🚀 Application started on http://localhost:3000");
  console.log("📝 Try these endpoints:");
  console.log("  GET  /users       - List users (with performance tracking)");
  console.log("  GET  /users/123   - Get user by ID (with custom context)");
  console.log("  POST /users       - Create user (with security tracking)");
  console.log("  GET  /health      - Health check (minimal tracking)");
}

// Run if this file is executed directly
if (require.main === module) {
  bootstrap().catch(console.error);
}