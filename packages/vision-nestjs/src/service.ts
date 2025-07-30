import { vision } from "@rodrigopsasaki/vision";
import type { ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, Optional, Scope } from "@nestjs/common";

import { VISION_NESTJS_OPTIONS, type VisionNestJSOptions } from "./types";

/**
 * Injectable Vision service for NestJS applications.
 * 
 * This service provides a DI-friendly way to interact with Vision contexts
 * and includes NestJS-specific utilities for enhanced observability.
 * 
 * The service is request-scoped to ensure proper context isolation
 * in multi-tenant or high-concurrency applications.
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UsersService {
 *   constructor(private readonly visionService: VisionService) {}
 * 
 *   async createUser(userData: CreateUserDto) {
 *     // Set business context
 *     this.visionService.setBusinessContext({
 *       operation: 'user_creation',
 *       user_type: userData.type,
 *       organization_id: userData.organizationId,
 *     });
 * 
 *     try {
 *       const user = await this.userRepository.create(userData);
 *       
 *       // Track success metrics
 *       this.visionService.trackEvent('user_created', {
 *         user_id: user.id,
 *         created_at: user.createdAt,
 *       });
 *       
 *       return user;
 *     } catch (error) {
 *       // Enhanced error tracking
 *       this.visionService.trackError('user_creation_failed', error, {
 *         attempted_email: userData.email,
 *         error_type: error.constructor.name,
 *       });
 *       
 *       throw error;
 *     }
 *   }
 * 
 *   async getUserAnalytics(userId: string) {
 *     return this.visionService.trackPerformance('get_user_analytics', async () => {
 *       // This will automatically track execution time and detect slow operations
 *       const analytics = await this.analyticsService.getUserAnalytics(userId);
 *       
 *       this.visionService.trackMetric('analytics_data_points', analytics.dataPoints.length);
 *       
 *       return analytics;
 *     });
 *   }
 * }
 * ```
 */
@Injectable({ scope: Scope.REQUEST })
export class VisionService {
  constructor(
    @Optional() @Inject(VISION_NESTJS_OPTIONS) private readonly options?: VisionNestJSOptions,
  ) {}

  /**
   * Sets business context information that's relevant across the entire request.
   * 
   * @param context - Business context data
   */
  setBusinessContext(context: Record<string, unknown>): void {
    try {
      vision.merge("business_context", context);
    } catch (error) {
      console.warn("[Vision Service] Error setting business context:", error);
    }
  }

  /**
   * Tracks a business event with associated data.
   * 
   * @param eventName - Name of the event
   * @param eventData - Data associated with the event
   */
  trackEvent(eventName: string, eventData?: Record<string, unknown>): void {
    try {
      const eventInfo = {
        event_name: eventName,
        event_timestamp: new Date().toISOString(),
        ...eventData,
      };

      vision.push("business_events", eventInfo);
    } catch (error) {
      console.warn("[Vision Service] Error tracking event:", error);
    }
  }

  /**
   * Tracks an error with enhanced context and categorization.
   * 
   * @param errorCategory - Category of the error (e.g., 'validation', 'database', 'external_api')
   * @param error - The error object
   * @param additionalContext - Additional context about the error
   */
  trackError(
    errorCategory: string,
    error: unknown,
    additionalContext?: Record<string, unknown>,
  ): void {
    try {
      const errorInfo: Record<string, any> = {
        error_category: errorCategory,
        error_name: error instanceof Error ? error.name : "UnknownError",
        error_message: error instanceof Error ? error.message : String(error),
        error_timestamp: new Date().toISOString(),
        ...additionalContext,
      };

      // Don't include stack trace in production unless specifically configured
      if (process.env.NODE_ENV !== "production" || this.options?.captureMethodExecution) {
        errorInfo.error_stack = error instanceof Error ? error.stack : undefined;
      }

      vision.merge("error_details", errorInfo);
    } catch (err) {
      console.warn("[Vision Service] Error tracking error:", err);
    }
  }

  /**
   * Tracks a custom metric value.
   * 
   * @param metricName - Name of the metric
   * @param value - Metric value
   * @param tags - Optional tags for the metric
   */
  trackMetric(metricName: string, value: number, tags?: Record<string, string>): void {
    try {
      const metricInfo = {
        metric_name: metricName,
        metric_value: value,
        metric_timestamp: new Date().toISOString(),
        metric_tags: tags,
      };

      vision.push("custom_metrics", metricInfo);
    } catch (error) {
      console.warn("[Vision Service] Error tracking metric:", error);
    }
  }

  /**
   * Wraps a function execution with performance tracking.
   * 
   * @param operationName - Name of the operation being tracked
   * @param operation - The operation to execute and track
   * @returns The result of the operation
   */
  async trackPerformance<T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();
      
      const executionTime = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      
      this.trackEvent("performance_operation", {
        operation_name: operationName,
        execution_time_ms: executionTime,
        memory_used_mb: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
        success: true,
      });

      // Check for slow operations
      const threshold = this.options?.performance?.slowOperationThreshold || 1000;
      if (executionTime > threshold) {
        this.trackEvent("slow_operation_detected", {
          operation_name: operationName,
          execution_time_ms: executionTime,
          threshold_ms: threshold,
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.trackEvent("performance_operation", {
        operation_name: operationName,
        execution_time_ms: executionTime,
        success: false,
        error_type: error instanceof Error ? error.constructor.name : "Unknown",
      });

      this.trackError("performance_operation_failed", error, {
        operation_name: operationName,
        execution_time_ms: executionTime,
      });

      throw error;
    }
  }

  /**
   * Tracks user interaction events for UX analytics.
   * 
   * @param interactionType - Type of interaction (e.g., 'click', 'view', 'download')
   * @param target - What was interacted with
   * @param metadata - Additional interaction metadata
   */
  trackUserInteraction(
    interactionType: string,
    target: string,
    metadata?: Record<string, unknown>,
  ): void {
    try {
      const interactionInfo = {
        interaction_type: interactionType,
        interaction_target: target,
        interaction_timestamp: new Date().toISOString(),
        ...metadata,
      };

      vision.push("user_interactions", interactionInfo);
    } catch (error) {
      console.warn("[Vision Service] Error tracking user interaction:", error);
    }
  }

  /**
   * Tracks external API calls for monitoring integrations.
   * 
   * @param apiName - Name of the external API
   * @param endpoint - API endpoint called
   * @param method - HTTP method used
   * @param statusCode - Response status code
   * @param responseTime - Time taken for the API call
   * @param additionalData - Additional API call data
   */
  trackExternalAPICall(
    apiName: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    additionalData?: Record<string, unknown>,
  ): void {
    try {
      const apiCallInfo = {
        api_name: apiName,
        api_endpoint: endpoint,
        api_method: method.toUpperCase(),
        api_status_code: statusCode,
        api_response_time_ms: responseTime,
        api_timestamp: new Date().toISOString(),
        api_success: statusCode >= 200 && statusCode < 300,
        ...additionalData,
      };

      vision.push("external_api_calls", apiCallInfo);

      // Track slow external API calls
      const slowApiThreshold = 5000; // 5 seconds
      if (responseTime > slowApiThreshold) {
        this.trackEvent("slow_external_api_call", {
          api_name: apiName,
          api_endpoint: endpoint,
          response_time_ms: responseTime,
          threshold_ms: slowApiThreshold,
        });
      }
    } catch (error) {
      console.warn("[Vision Service] Error tracking external API call:", error);
    }
  }

  /**
   * Tracks database operations for performance monitoring.
   * 
   * @param operation - Type of database operation (e.g., 'select', 'insert', 'update', 'delete')
   * @param table - Database table/collection name
   * @param executionTime - Time taken for the operation
   * @param rowsAffected - Number of rows/documents affected
   * @param additionalData - Additional operation data
   */
  trackDatabaseOperation(
    operation: string,
    table: string,
    executionTime: number,
    rowsAffected?: number,
    additionalData?: Record<string, unknown>,
  ): void {
    try {
      const dbOperationInfo = {
        db_operation: operation.toLowerCase(),
        db_table: table,
        db_execution_time_ms: executionTime,
        db_rows_affected: rowsAffected,
        db_timestamp: new Date().toISOString(),
        ...additionalData,
      };

      vision.push("database_operations", dbOperationInfo);

      // Track slow database operations
      const slowDbThreshold = 1000; // 1 second
      if (executionTime > slowDbThreshold) {
        this.trackEvent("slow_database_operation", {
          db_operation: operation,
          db_table: table,
          execution_time_ms: executionTime,
          threshold_ms: slowDbThreshold,
        });
      }
    } catch (error) {
      console.warn("[Vision Service] Error tracking database operation:", error);
    }
  }

  /**
   * Adds security-related context to the current vision context.
   * 
   * @param securityContext - Security-related information
   */
  addSecurityContext(securityContext: Record<string, unknown>): void {
    try {
      vision.merge("security_context", {
        ...securityContext,
        security_timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("[Vision Service] Error adding security context:", error);
    }
  }

  /**
   * Gets the current vision context (if available).
   * 
   * @returns The current vision context or undefined if not in a vision context
   */
  getCurrentContext() {
    try {
      return vision.context();
    } catch {
      return undefined;
    }
  }

  /**
   * Checks if we're currently in a vision context.
   * 
   * @returns True if in a vision context, false otherwise
   */
  isInContext(): boolean {
    return this.getCurrentContext() !== undefined;
  }

  /**
   * Creates a child context for nested operations.
   * 
   * @param name - Name of the child operation
   * @param operation - The operation to execute in the child context
   * @returns The result of the operation
   */
  async withChildContext<T>(name: string, operation: () => Promise<T>): Promise<T> {
    return vision.observe(
      {
        name: `${name}.child`,
        scope: "nested",
        source: "vision-service",
        initial: {
          parent_context: this.getCurrentContext()?.id,
          child_operation: name,
        },
      },
      operation,
    );
  }

  // Direct proxies to vision methods for convenience
  set = vision.set.bind(vision);
  get = vision.get.bind(vision);
  push = vision.push.bind(vision);
  merge = vision.merge.bind(vision);
}