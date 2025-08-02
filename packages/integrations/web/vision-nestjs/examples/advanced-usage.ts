import { vision } from "@rodrigopsasaki/vision";
import {
  Controller,
  Get,
  Injectable,
  Module,
  UseGuards,
  ExecutionContext,
  CanActivate,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";

import {
  VisionModule,
  VisionService,
  VisionGuard,
  VisionContext,
  VisionAudit,
  VisionPerformance,
  type VisionModuleAsyncOptions,
} from "../src";

// Custom guard that integrates with Vision
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly visionService: VisionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Simulate authentication
    const authHeader = request.headers.authorization;
    const isAuthenticated = authHeader && authHeader.startsWith("Bearer ");

    // Add authentication context to Vision using core API
    vision.merge("security", {
      authentication_attempt: true,
      authentication_method: authHeader ? "bearer_token" : "none",
      authentication_success: isAuthenticated,
      ip_address: request.ip,
      user_agent: request.headers["user-agent"],
    });

    if (!isAuthenticated) {
      // Track failed authentication using core Vision API
      vision.push("events", {
        event: "authentication_failed",
        reason: "missing_or_invalid_token",
        ip_address: request.ip,
        requested_resource: request.path,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    // Mock user extraction
    request.user = {
      id: "user-123",
      email: "admin@example.com",
      roles: ["admin"],
      permissions: ["read", "write", "delete"],
    };

    // Track successful authentication
    vision.push("events", {
      event: "authentication_success",
      user_id: request.user.id,
      user_roles: request.user.roles,
      timestamp: new Date().toISOString(),
    });

    return true;
  }
}

// Service with advanced Vision usage
@Injectable()
export class AnalyticsService {
  constructor(private readonly visionService: VisionService) {}

  async generateReport(reportType: string, filters: any) {
    // Create child context for nested operation using core Vision API
    return vision.observe(
      {
        name: `analytics.report.${reportType}`,
        scope: "nested",
        source: "nestjs",
      },
      async () => {
        // Set business context using core API
        vision.merge("business_context", {
          report_type: reportType,
          filter_count: Object.keys(filters).length,
          estimated_complexity: this.calculateComplexity(filters),
        });

        // Simulate complex data processing
        const steps = ["fetch_data", "process_data", "generate_charts", "format_output"];

        for (const step of steps) {
          const stepStartTime = Date.now();
          try {
            // Simulate step processing time
            const processingTime = Math.random() * 500 + 100;
            await new Promise((resolve) => setTimeout(resolve, processingTime));

            // Track step completion using core API
            vision.push("events", {
              event: "report_step_completed",
              step,
              processing_time_ms: processingTime,
              timestamp: new Date().toISOString(),
            });

            vision.push("performance", {
              operation: `report_step.${step}`,
              duration_ms: Date.now() - stepStartTime,
              success: true,
            });
          } catch (error) {
            vision.push("performance", {
              operation: `report_step.${step}`,
              duration_ms: Date.now() - stepStartTime,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }

        // Track database operations during report generation
        vision.push("database_operations", {
          operation: "select",
          table: "analytics_data",
          duration_ms: 250,
          rows_affected: 1500,
          query_complexity: "high",
          index_usage: "optimal",
          timestamp: new Date().toISOString(),
        });

        // Simulate external API calls for enrichment
        vision.push("external_api_calls", {
          service: "enrichment-service",
          endpoint: "/api/v1/enrich",
          method: "POST",
          status_code: 200,
          duration_ms: 180,
          enrichment_type: "geo_data",
          records_enriched: 1500,
          timestamp: new Date().toISOString(),
        });

        const report = {
          id: `report-${Date.now()}`,
          type: reportType,
          generatedAt: new Date(),
          dataPoints: Math.floor(Math.random() * 10000) + 1000,
          processingTimeMs: Date.now() - Date.now(),
        };

        // Track final metrics using core API
        vision.push("metrics", {
          metric: "report_data_points",
          value: report.dataPoints,
          timestamp: new Date().toISOString(),
        });

        vision.push("events", {
          event: "report_generated",
          report_id: report.id,
          report_type: reportType,
          data_points: report.dataPoints,
          timestamp: new Date().toISOString(),
        });

        return report;
      },
    );
  }

  private calculateComplexity(filters: any): "low" | "medium" | "high" {
    const filterCount = Object.keys(filters).length;
    if (filterCount <= 2) return "low";
    if (filterCount <= 5) return "medium";
    return "high";
  }
}

// Controller with advanced decorators and guards
@Controller("analytics")
@UseGuards(AuthGuard, VisionGuard) // Multiple guards with Vision integration
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly visionService: VisionService,
  ) {}

  @Get("reports/sales")
  @VisionPerformance("analytics.sales_report")
  @VisionAudit({
    operation: "generate_sales_report",
    captureActor: true,
    captureTarget: false,
    requiresApproval: false,
  })
  async getSalesReport() {
    // Add specific context for this high-value operation using core API
    vision.merge("business_context", {
      report_category: "financial",
      data_sensitivity: "high",
      compliance_required: true,
    });

    // Track user interaction using core API
    vision.push("user_interactions", {
      action: "report_request",
      target: "sales_report",
      dashboard_source: "main_dashboard",
      user_role: "analyst",
      timestamp: new Date().toISOString(),
    });

    return this.analyticsService.generateReport("sales", {
      period: "last_30_days",
      granularity: "daily",
      includeProjections: true,
    });
  }

  @Get("reports/user-engagement")
  @VisionContext({
    name: "analytics.user_engagement_report",
    scope: "reporting",
    trackPerformance: true,
    initial: {
      report_category: "product",
      estimated_duration: "2-5_seconds",
    },
  })
  async getUserEngagementReport() {
    // This report is less sensitive but still important for tracking
    vision.push("user_interactions", {
      action: "report_request",
      target: "user_engagement_report",
      timestamp: new Date().toISOString(),
    });

    return this.analyticsService.generateReport("user_engagement", {
      period: "last_7_days",
      segment: "all_users",
    });
  }

  @Get("dashboard/:userId")
  @VisionContext({
    name: "analytics.personal_dashboard",
    captureParams: true,
    captureReturn: false, // Don't capture personal data
  })
  async getPersonalDashboard() {
    // Example of accessing current Vision context
    const currentContext = this.visionService.getCurrentContext();

    if (currentContext) {
      console.log("Processing request in context:", currentContext.id);
    }

    // Simulate personalized analytics
    return {
      userId: "user-123",
      metrics: {
        totalSessions: 45,
        averageSessionDuration: "5m 23s",
        lastActivity: new Date(),
      },
      recommendations: ["Try the new reporting feature", "Complete your profile"],
    };
  }
}

// Configuration factory for async module setup
@Injectable()
export class VisionConfigService {
  constructor(private configService: ConfigService) {}

  createVisionOptions() {
    const isProduction = this.configService.get("NODE_ENV") === "production";

    return {
      enabled: this.configService.get("VISION_ENABLED", !isProduction),

      // Capture settings based on environment
      captureRequest: !isProduction,
      captureHeaders: this.configService.get("VISION_CAPTURE_HEADERS", false),
      captureBody: this.configService.get("VISION_CAPTURE_BODY", false),
      captureMethodExecution: !isProduction,

      // Performance settings
      performance: {
        trackExecutionTime: true,
        trackMemoryUsage: this.configService.get("VISION_TRACK_MEMORY", false),
        slowOperationThreshold: this.configService.get("VISION_SLOW_THRESHOLD", 2000),
      },

      // Exclude routes based on environment
      excludeRoutes: [
        "/health",
        "/metrics",
        "/favicon.ico",
        ...(isProduction ? ["/docs", "/api-docs"] : []),
      ],

      // Custom user extraction with error handling
      extractUser: (context) => {
        try {
          const request = context.switchToHttp().getRequest();
          if (!request.user) return undefined;

          return {
            id: request.user.id,
            email: request.user.email,
            roles: request.user.roles || [],
            organization: request.user.organizationId,
            // Don't include sensitive fields
          };
        } catch (error) {
          console.warn("Error extracting user for Vision:", error);
          return undefined;
        }
      },

      // Enhanced error transformation
      transformError: (error: unknown, context) => {
        const baseError = {
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          context_type: context.getType(),
          handler: context.getHandler().name,
          controller: context.getClass().name,
        };

        // Add stack trace in development
        if (!isProduction && error instanceof Error) {
          baseError.stack = error.stack;
        }

        // Add custom error context based on error type
        if (error instanceof Error) {
          if (error.name === "ValidationError") {
            baseError.category = "validation";
          } else if (error.name === "UnauthorizedError") {
            baseError.category = "security";
          } else if (error.message.includes("timeout")) {
            baseError.category = "performance";
          }
        }

        return baseError;
      },
    };
  }
}

// Advanced module configuration with async setup
@Module({
  imports: [
    // Load configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),

    // Configure Vision asynchronously with custom factory
    VisionModule.forRootAsync(
      {
        imports: [ConfigModule],
        useClass: VisionConfigService,
        isGlobal: true,
      },
      true,
    ), // Enable Vision Guard
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AuthGuard, VisionConfigService],
})
export class AdvancedAppModule {}

// Example of manual Vision setup with custom exporters
export async function setupVisionWithCustomExporters() {
  // Initialize Vision with multiple exporters
  vision.init({
    exporters: [
      // Console exporter for development
      {
        name: "enhanced-console",
        success: (ctx) => {
          console.log(`✅ [${ctx.name}] Success:`, {
            id: ctx.id,
            duration: ctx.data.get("execution_time_ms"),
            data_points: Array.from(ctx.data.entries()).length,
          });
        },
        error: (ctx, error) => {
          console.error(`❌ [${ctx.name}] Error:`, {
            id: ctx.id,
            error: error instanceof Error ? error.message : String(error),
            context: Object.fromEntries(ctx.data.entries()),
          });
        },
      },

      // File exporter for persistent logging
      {
        name: "file-logger",
        success: (ctx) => {
          const logEntry = {
            timestamp: ctx.timestamp,
            context_id: ctx.id,
            context_name: ctx.name,
            scope: ctx.scope,
            source: ctx.source,
            success: true,
            data: Object.fromEntries(ctx.data.entries()),
          };

          // In a real app, you'd write to a file or send to a logging service
          console.log("📁 File Log:", JSON.stringify(logEntry, null, 2));
        },
        error: (ctx, error) => {
          const logEntry = {
            timestamp: ctx.timestamp,
            context_id: ctx.id,
            context_name: ctx.name,
            scope: ctx.scope,
            source: ctx.source,
            success: false,
            error: {
              name: error instanceof Error ? error.name : "UnknownError",
              message: error instanceof Error ? error.message : String(error),
            },
            data: Object.fromEntries(ctx.data.entries()),
          };

          console.error("📁 File Log (Error):", JSON.stringify(logEntry, null, 2));
        },
      },

      // Metrics exporter for performance monitoring
      {
        name: "metrics-collector",
        success: (ctx) => {
          const executionTime = ctx.data.get("execution_time_ms");
          const isSlowOperation = ctx.data.get("slow_operation");

          if (typeof executionTime === "number") {
            console.log(`📊 Metric: ${ctx.name}.execution_time = ${executionTime}ms`);

            if (isSlowOperation) {
              console.warn(`🐌 Slow operation detected: ${ctx.name} took ${executionTime}ms`);
            }
          }

          // Track custom metrics
          const customMetrics = ctx.data.get("custom_metrics");
          if (Array.isArray(customMetrics)) {
            customMetrics.forEach((metric: any) => {
              console.log(`📊 Custom Metric: ${metric.metric_name} = ${metric.metric_value}`);
            });
          }
        },
      },
    ],

    // Configure key normalization for consistent metric names
    normalization: {
      enabled: true,
      keyCasing: "snake_case",
      deep: true,
    },
  });
}
