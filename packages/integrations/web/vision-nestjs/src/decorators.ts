import { SetMetadata } from "@nestjs/common";

import {
  VISION_CAPTURE_METADATA,
  VISION_CONTEXT_METADATA,
  VISION_IGNORE_METADATA,
  type VisionCaptureConfig,
  type VisionContextConfig,
} from "./types";

/**
 * Decorator to configure Vision context behavior for a specific method or class.
 *
 * When applied to a method, it overrides global Vision configuration for that specific method.
 * When applied to a class, it applies to all methods in that class (unless overridden at method level).
 *
 * @param config - Vision context configuration
 *
 * @example
 * ```typescript
 * @Controller('users')
 * export class UsersController {
 *   @Get(':id')
 *   @VisionContext({
 *     name: 'user.get_by_id',
 *     scope: 'api',
 *     captureParams: true,
 *     captureReturn: false,
 *     initial: { operation: 'read' }
 *   })
 *   async getUser(@Param('id') id: string) {
 *     return this.usersService.findById(id);
 *   }
 *
 *   @Post()
 *   @VisionContext({
 *     name: 'user.create',
 *     trackPerformance: true
 *   })
 *   async createUser(@Body() createUserDto: CreateUserDto) {
 *     return this.usersService.create(createUserDto);
 *   }
 * }
 * ```
 */
export function VisionContext(config: VisionContextConfig) {
  return SetMetadata(VISION_CONTEXT_METADATA, config);
}

/**
 * Decorator to ignore Vision context creation for a specific method or class.
 *
 * When applied to a method, Vision will skip creating a context for that method.
 * When applied to a class, Vision will skip all methods in that class.
 *
 * This is useful for:
 * - Health check endpoints
 * - Internal utility methods
 * - High-frequency operations where observability overhead is not desired
 *
 * @example
 * ```typescript
 * @Controller('health')
 * @VisionIgnore() // Ignore entire controller
 * export class HealthController {
 *   @Get()
 *   check() {
 *     return { status: 'ok' };
 *   }
 * }
 *
 * @Controller('users')
 * export class UsersController {
 *   @Get()
 *   async getUsers() {
 *     return this.usersService.findAll();
 *   }
 *
 *   @Get('internal/cache-warmup')
 *   @VisionIgnore() // Ignore specific method
 *   async warmupCache() {
 *     return this.cacheService.warmup();
 *   }
 * }
 * ```
 */
export function VisionIgnore() {
  return SetMetadata(VISION_IGNORE_METADATA, true);
}

/**
 * Decorator to configure what data Vision should capture for a specific method or class.
 *
 * This allows fine-grained control over data capture at the method level,
 * overriding global configuration settings.
 *
 * @param config - Vision capture configuration
 *
 * @example
 * ```typescript
 * @Controller('users')
 * export class UsersController {
 *   @Get()
 *   @VisionCapture({
 *     request: true,
 *     headers: false,
 *     query: true,
 *     params: false,
 *     returns: true
 *   })
 *   async getUsers(@Query() query: GetUsersDto) {
 *     return this.usersService.findAll(query);
 *   }
 *
 *   @Post()
 *   @VisionCapture({
 *     body: true,
 *     params: true,
 *     returns: false, // Don't capture user data in response
 *     customFields: ['ip_address', 'user_agent']
 *   })
 *   async createUser(@Body() createUserDto: CreateUserDto) {
 *     return this.usersService.create(createUserDto);
 *   }
 *
 *   @Delete(':id')
 *   @VisionCapture({
 *     params: true,
 *     returns: false,
 *     customFields: ['admin_user_id'] // Capture who performed the deletion
 *   })
 *   async deleteUser(@Param('id') id: string) {
 *     return this.usersService.delete(id);
 *   }
 * }
 * ```
 */
export function VisionCapture(config: VisionCaptureConfig) {
  return SetMetadata(VISION_CAPTURE_METADATA, config);
}

/**
 * Decorator to mark a method as a high-performance operation that should be tracked.
 *
 * This is a convenience decorator that sets up Vision context with performance tracking enabled
 * and commonly used settings for performance-critical operations.
 *
 * @param name - Optional custom name for the operation
 *
 * @example
 * ```typescript
 * @Controller('analytics')
 * export class AnalyticsController {
 *   @Post('report')
 *   @VisionPerformance('analytics.generate_report')
 *   async generateReport(@Body() reportConfig: ReportConfig) {
 *     // This will automatically track execution time, memory usage, and detect slow operations
 *     return this.analyticsService.generateReport(reportConfig);
 *   }
 *
 *   @Get('dashboard/:id')
 *   @VisionPerformance() // Uses default naming: http.AnalyticsController.getDashboard
 *   async getDashboard(@Param('id') id: string) {
 *     return this.analyticsService.getDashboard(id);
 *   }
 * }
 * ```
 */
export function VisionPerformance(name?: string) {
  return VisionContext({
    name,
    trackPerformance: true,
    captureParams: true,
    captureReturn: false, // Usually don't want to capture large response payloads
  });
}

/**
 * Decorator to mark a method as security-sensitive, enabling enhanced capture.
 *
 * This decorator configures Vision to capture additional security-relevant information
 * while being careful not to capture sensitive data like passwords or tokens.
 *
 * @param config - Optional additional configuration
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   @Post('login')
 *   @VisionSecurity({
 *     captureFailures: true,
 *     captureUserAgent: true,
 *     captureIpAddress: true
 *   })
 *   async login(@Body() loginDto: LoginDto) {
 *     return this.authService.login(loginDto);
 *   }
 *
 *   @Post('password-reset')
 *   @VisionSecurity()
 *   async resetPassword(@Body() resetDto: PasswordResetDto) {
 *     return this.authService.resetPassword(resetDto);
 *   }
 * }
 * ```
 */
export function VisionSecurity(config?: {
  captureFailures?: boolean;
  captureUserAgent?: boolean;
  captureIpAddress?: boolean;
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Apply Vision context configuration
    VisionContext({
      scope: "security",
      captureParams: false, // Don't capture params that might contain passwords
      captureReturn: false, // Don't capture tokens or sensitive response data
      trackPerformance: true,
      initial: {
        security_operation: true,
        capture_failures: config?.captureFailures ?? true,
        capture_user_agent: config?.captureUserAgent ?? true,
        capture_ip_address: config?.captureIpAddress ?? true,
      },
    })(target, propertyKey, descriptor);

    // Apply capture configuration
    VisionCapture({
      request: true,
      headers: false, // Headers might contain authorization tokens
      body: false, // Body might contain passwords
      query: true,
      params: false, // Params are usually fine, but being extra cautious
      returns: false, // Response might contain tokens
      customFields: [
        ...(config?.captureUserAgent ? ["user_agent"] : []),
        ...(config?.captureIpAddress ? ["ip_address"] : []),
        "timestamp",
        "operation_type",
      ],
    })(target, propertyKey, descriptor);
  };
}

/**
 * Decorator to configure a method for audit logging with Vision.
 *
 * This decorator ensures that critical business operations are properly tracked
 * with all necessary audit information while maintaining security.
 *
 * @param config - Audit configuration
 *
 * @example
 * ```typescript
 * @Controller('admin')
 * export class AdminController {
 *   @Delete('users/:id')
 *   @VisionAudit({
 *     operation: 'user_deletion',
 *     captureActor: true,
 *     captureTarget: true,
 *     requiresApproval: false
 *   })
 *   async deleteUser(@Param('id') userId: string) {
 *     return this.adminService.deleteUser(userId);
 *   }
 *
 *   @Post('system/maintenance')
 *   @VisionAudit({
 *     operation: 'system_maintenance',
 *     captureActor: true,
 *     requiresApproval: true
 *   })
 *   async enableMaintenanceMode() {
 *     return this.systemService.enableMaintenanceMode();
 *   }
 * }
 * ```
 */
export function VisionAudit(config: {
  operation: string;
  captureActor?: boolean;
  captureTarget?: boolean;
  requiresApproval?: boolean;
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    VisionContext({
      name: `audit.${config.operation}`,
      scope: "audit",
      captureParams: config.captureTarget ?? true,
      captureReturn: false, // Audit logs shouldn't include response data
      trackPerformance: true,
      initial: {
        audit_operation: config.operation,
        capture_actor: config.captureActor ?? true,
        capture_target: config.captureTarget ?? true,
        requires_approval: config.requiresApproval ?? false,
        audit_timestamp: new Date().toISOString(),
      },
    })(target, propertyKey, descriptor);

    VisionCapture({
      request: true,
      headers: false,
      body: config.captureTarget ?? true,
      query: true,
      params: config.captureTarget ?? true,
      returns: false,
      customFields: [
        ...(config.captureActor ? ["actor_id", "actor_role"] : []),
        "operation_type",
        "timestamp",
        "ip_address",
        "user_agent",
      ],
    })(target, propertyKey, descriptor);
  };
}
