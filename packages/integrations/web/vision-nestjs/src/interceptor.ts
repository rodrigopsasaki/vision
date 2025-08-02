import "reflect-metadata";
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { vision } from "@rodrigopsasaki/vision";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";

import {
  DEFAULT_VISION_NESTJS_OPTIONS,
  VISION_CAPTURE_METADATA,
  VISION_CONTEXT_METADATA,
  VISION_IGNORE_METADATA,
  VISION_NESTJS_OPTIONS,
  type VisionCaptureConfig,
  type VisionContextConfig,
  type VisionExecutionContextType,
  type VisionNestJSOptions,
  type VisionRequest,
  type VisionResponse,
} from "./types";
import {
  extractGraphQLInfo,
  extractHttpInfo,
  extractMicroserviceInfo,
  extractWebSocketInfo,
  isRouteExcluded,
  redactSensitiveData,
} from "./utils";

/**
 * Advanced Vision interceptor for NestJS applications.
 *
 * This interceptor provides comprehensive observability integration across all NestJS execution contexts:
 * - HTTP requests (Express/Fastify)
 * - GraphQL operations
 * - WebSocket events
 * - Microservice messages (TCP, Redis, NATS, etc.)
 *
 * Features:
 * - Automatic context creation and propagation
 * - Method-level configuration via decorators
 * - Performance tracking and slow operation detection
 * - Security-aware data capture with automatic redaction
 * - Cross-cutting concerns integration (guards, pipes, filters)
 * - Microservice and event-driven architecture support
 *
 * @example
 * ```typescript
 * // Global installation
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useClass: VisionInterceptor,
 *     },
 *   ],
 * })
 * export class AppModule {}
 *
 * // Or with custom configuration
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useFactory: (options: VisionNestJSOptions) => new VisionInterceptor(options),
 *       inject: [VISION_NESTJS_OPTIONS],
 *     },
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class VisionInterceptor implements NestInterceptor {
  private readonly config: Required<VisionNestJSOptions>;

  constructor(
    @Optional() @Inject(VISION_NESTJS_OPTIONS) options?: VisionNestJSOptions,
    @Optional() private readonly reflector?: Reflector,
  ) {
    this.config = {
      ...DEFAULT_VISION_NESTJS_OPTIONS,
      ...options,
      performance: {
        ...DEFAULT_VISION_NESTJS_OPTIONS.performance,
        ...options?.performance,
      },
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Check if Vision is disabled globally
    if (!this.config.enabled) {
      return next.handle();
    }

    // Check if this method/class is marked to be ignored
    const isIgnored = this.reflector?.getAllAndOverride<boolean>(VISION_IGNORE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isIgnored) {
      return next.handle();
    }

    // Check if this route should be excluded
    if (this.shouldExcludeRoute(context)) {
      return next.handle();
    }

    // Get method-level configuration
    const methodConfig = this.reflector?.getAllAndOverride<VisionContextConfig>(
      VISION_CONTEXT_METADATA,
      [context.getHandler(), context.getClass()],
    );

    const captureConfig = this.reflector?.getAllAndOverride<VisionCaptureConfig>(
      VISION_CAPTURE_METADATA,
      [context.getHandler(), context.getClass()],
    );

    // Generate context configuration
    const contextConfig = this.buildContextConfig(context, methodConfig);
    const performanceStartTime = Date.now();
    const memoryUsageStart = this.config.performance.trackMemoryUsage
      ? process.memoryUsage()
      : undefined;

    return new Observable((subscriber) => {
      vision.observe(contextConfig, async () => {
        try {
          // Capture initial context data
          await this.captureInitialData(context, captureConfig);

          // Execute the handler and capture the result
          const result = await new Promise((resolve, reject) => {
            next.handle().subscribe({
              next: resolve,
              error: reject,
            });
          });

          // Capture success metadata
          this.captureSuccessMetadata(
            context,
            result,
            performanceStartTime,
            memoryUsageStart,
            captureConfig,
          );

          subscriber.next(result);
          subscriber.complete();
        } catch (error) {
          // Capture error metadata
          this.captureErrorMetadata(context, error, performanceStartTime, memoryUsageStart);

          subscriber.error(error);
        }
      });
    }).pipe(
      tap((data) => {
        // Additional post-processing if needed
        this.postProcessSuccess(context, data);
      }),
      catchError((error) => {
        // Additional error processing
        this.postProcessError(context, error);
        return throwError(() => error);
      }),
    );
  }

  private shouldExcludeRoute(context: ExecutionContext): boolean {
    const contextType = context.getType<VisionExecutionContextType>();

    // Only check route exclusion for HTTP contexts
    if (contextType !== "http") {
      return false;
    }

    try {
      const request = context.switchToHttp().getRequest<VisionRequest>();
      return isRouteExcluded(request.path || request.url || "", this.config.excludeRoutes);
    } catch {
      return false;
    }
  }

  private buildContextConfig(context: ExecutionContext, methodConfig?: VisionContextConfig) {
    const contextType = context.getType<VisionExecutionContextType>();
    const baseContextName = methodConfig?.name || this.config.generateContextName(context);

    // Extract correlation ID based on context type
    const correlationId = this.extractCorrelationId(context);

    // Extract user information
    const user = this.config.extractUser(context);

    return {
      name: baseContextName,
      scope: methodConfig?.scope || contextType,
      source: methodConfig?.source || "nestjs",
      initial: {
        timestamp: new Date().toISOString(),
        execution_context: contextType,
        controller: context.getClass().name,
        handler: context.getHandler().name,
        ...(correlationId && { correlation_id: correlationId }),
        ...(user ? { user } : {}),
        ...methodConfig?.initial,
      },
    };
  }

  private async captureInitialData(context: ExecutionContext, captureConfig?: VisionCaptureConfig) {
    const contextType = context.getType<VisionExecutionContextType>();

    try {
      switch (contextType) {
        case "http":
          await this.captureHttpData(context, captureConfig);
          break;
        case "graphql":
          await this.captureGraphQLData(context, captureConfig);
          break;
        case "ws":
          await this.captureWebSocketData(context, captureConfig);
          break;
        case "rpc":
          await this.captureMicroserviceData(context, captureConfig);
          break;
      }
    } catch (error) {
      // Don't let data capture errors break the request
      console.warn("[Vision] Error capturing initial data:", error);
      vision.set("capture_error", {
        type: "initial_data_capture",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async captureHttpData(context: ExecutionContext, captureConfig?: VisionCaptureConfig) {
    if (!this.config.captureRequest && !captureConfig?.request) {
      return;
    }

    const request = context.switchToHttp().getRequest<VisionRequest>();
    const response = context.switchToHttp().getResponse<VisionResponse>();

    // Attach Vision context to request/response for later access
    const visionContext = vision.context();
    request.visionContext = visionContext;
    response.visionContext = visionContext;

    // Add request ID to response headers if configured
    if (this.config.includeRequestId && response.setHeader) {
      response.setHeader(this.config.requestIdHeader, visionContext.id);
    }

    const httpInfo = extractHttpInfo(request, {
      captureHeaders: captureConfig?.headers ?? this.config.captureHeaders,
      captureQuery: captureConfig?.query ?? this.config.captureQueryParams,
      captureBody: captureConfig?.body ?? this.config.captureBody,
      redactHeaders: this.config.redactHeaders,
      redactQuery: this.config.redactQueryParams,
      redactBody: this.config.redactBodyFields,
    });

    vision.merge("request", httpInfo);
  }

  private async captureGraphQLData(context: ExecutionContext, _captureConfig?: VisionCaptureConfig) {
    if (!this.config.captureGraphQLOperation) {
      return;
    }

    try {
      const graphqlInfo = extractGraphQLInfo(context);
      vision.merge("graphql", graphqlInfo);
    } catch (error) {
      console.warn("[Vision] Error capturing GraphQL data:", error);
    }
  }

  private async captureWebSocketData(
    context: ExecutionContext,
    _captureConfig?: VisionCaptureConfig,
  ) {
    if (!this.config.captureWebSocketEvents) {
      return;
    }

    try {
      const wsInfo = extractWebSocketInfo(context);
      vision.merge("websocket", wsInfo);
    } catch (error) {
      console.warn("[Vision] Error capturing WebSocket data:", error);
    }
  }

  private async captureMicroserviceData(
    context: ExecutionContext,
    _captureConfig?: VisionCaptureConfig,
  ) {
    if (!this.config.captureMicroserviceMessages) {
      return;
    }

    try {
      const microserviceInfo = extractMicroserviceInfo(context);
      vision.merge("microservice", microserviceInfo);
    } catch (error) {
      console.warn("[Vision] Error capturing microservice data:", error);
    }
  }

  private captureSuccessMetadata(
    context: ExecutionContext,
    result: any,
    startTime: number,
    memoryStart: NodeJS.MemoryUsage | undefined,
    captureConfig?: VisionCaptureConfig,
  ) {
    const executionTime = Date.now() - startTime;

    // Capture performance metrics
    if (this.config.performance.trackExecutionTime) {
      vision.set("execution_time_ms", executionTime);

      // Mark slow operations
      if (
        this.config.performance.slowOperationThreshold &&
        executionTime > this.config.performance.slowOperationThreshold
      ) {
        vision.set("slow_operation", true);
        vision.set("slow_operation_threshold_ms", this.config.performance.slowOperationThreshold);
      }
    }

    // Capture memory usage
    if (this.config.performance.trackMemoryUsage && memoryStart) {
      const memoryEnd = process.memoryUsage();
      const memoryDelta = {
        rss: memoryEnd.rss - memoryStart.rss,
        heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
        heapTotal: memoryEnd.heapTotal - memoryStart.heapTotal,
        external: memoryEnd.external - memoryStart.external,
      };
      vision.set("memory_usage_delta", memoryDelta);
    }

    // Capture method return value if configured
    const shouldCaptureReturn = captureConfig?.returns ?? this.config.captureMethodReturns;
    if (shouldCaptureReturn && result !== undefined) {
      // Redact sensitive data from return value
      const redactedResult = redactSensitiveData(result, this.config.redactBodyFields);
      vision.set("return_value", redactedResult);
    }

    // Capture HTTP response metadata
    const contextType = context.getType<VisionExecutionContextType>();
    if (contextType === "http") {
      try {
        const response = context.switchToHttp().getResponse<VisionResponse>();
        vision.merge("response", {
          status_code: response?.statusCode,
          headers: response?.getHeaders ? response.getHeaders() : {},
        });
      } catch (error) {
        console.warn("[Vision] Error capturing HTTP response metadata:", error);
      }
    }

    vision.set("success", true);
  }

  private captureErrorMetadata(
    context: ExecutionContext,
    error: unknown,
    startTime: number,
    memoryStart: NodeJS.MemoryUsage | undefined,
  ) {
    const executionTime = Date.now() - startTime;

    // Capture performance metrics even for errors
    if (this.config.performance.trackExecutionTime) {
      vision.set("execution_time_ms", executionTime);
    }

    if (this.config.performance.trackMemoryUsage && memoryStart) {
      const memoryEnd = process.memoryUsage();
      const memoryDelta = {
        rss: memoryEnd.rss - memoryStart.rss,
        heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
        heapTotal: memoryEnd.heapTotal - memoryStart.heapTotal,
        external: memoryEnd.external - memoryStart.external,
      };
      vision.set("memory_usage_delta", memoryDelta);
    }

    // Transform and capture error
    const errorData = this.config.transformError(error, context);
    vision.merge("error", errorData);

    vision.set("success", false);
  }

  private extractCorrelationId(context: ExecutionContext): string | undefined {
    const contextType = context.getType<VisionExecutionContextType>();

    if (contextType === "http") {
      try {
        const request = context.switchToHttp().getRequest();

        for (const header of this.config.correlationIdHeaders) {
          const value = request.headers?.[header] || request.headers?.[header.toLowerCase()];
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }
      } catch {
        // Ignore errors when extracting correlation ID
      }
    }

    return undefined;
  }

  private postProcessSuccess(_context: ExecutionContext, _data: any) {
    // Hook for additional post-processing after successful execution
    // Can be extended for custom business logic
  }

  private postProcessError(_context: ExecutionContext, _error: any) {
    // Hook for additional post-processing after error
    // Can be extended for custom error handling
  }
}
