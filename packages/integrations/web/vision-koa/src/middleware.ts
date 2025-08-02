import { vision } from "@rodrigopsasaki/vision";
import type { Context, Next } from "koa";

import type { VisionKoaOptions, VisionKoaMiddleware, VisionKoaContext } from "./types";
import { DEFAULT_VISION_KOA_OPTIONS } from "./types";
import {
  extractRequestMetadata,
  extractResponseMetadata,
  extractErrorMetadata,
  isRouteExcluded,
  isSlowOperation,
  generateRequestId,
  mergeOptions,
} from "./utils";

/**
 * Creates a Vision Koa middleware that automatically creates contexts for HTTP requests.
 *
 * This middleware wraps each request in a Vision context, automatically capturing
 * request/response metadata and providing easy access to the context throughout
 * the request lifecycle.
 *
 * @param options - Configuration options for the middleware
 * @returns Koa middleware function
 *
 * @example
 * ```typescript
 * import Koa from 'koa';
 * import { createVisionMiddleware } from '@rodrigopsasaki/vision-koa';
 *
 * const app = new Koa();
 *
 * // Basic usage - just works out of the box
 * app.use(createVisionMiddleware());
 *
 * // Advanced usage with custom options
 * app.use(createVisionMiddleware({
 *   captureBody: true,
 *   excludeRoutes: ["/health", "/metrics"],
 *   extractUser: (ctx) => ctx.state.user,
 * }));
 *
 * app.use(async (ctx, next) => {
 *   // Access the Vision context
 *   const visionContext = ctx.visionContext;
 *
 *   // Add custom data to the context
 *   vision.set('user_id', ctx.params?.id);
 *   vision.set('operation', 'get_user');
 *
 *   // Your route logic here...
 *   ctx.body = { message: 'Hello World' };
 * });
 * ```
 */
export function createVisionMiddleware(options: VisionKoaOptions = {}): VisionKoaMiddleware {
  const config = mergeOptions(options);

  return async (ctx: Context, next: Next) => {
    // Skip if disabled or excluded route
    if (
      !config.enabled ||
      config.shouldExcludeRoute(ctx) ||
      isRouteExcluded(ctx.path, config.excludeRoutes)
    ) {
      return await next();
    }

    const startTime = Date.now();
    const memoryStart = config.performance.trackMemoryUsage ? process.memoryUsage() : undefined;

    // Generate context configuration
    const contextName = config.contextNameGenerator(ctx);
    const correlationId = config.extractCorrelationId(ctx);
    const user = config.extractUser(ctx);
    const additionalMetadata = config.extractMetadata(ctx);

    const contextConfig = {
      name: contextName,
      scope: "http",
      source: "koa",
      initial: {
        timestamp: new Date().toISOString(),
        execution_context: "koa",
        method: ctx.method,
        url: ctx.url,
        path: ctx.path,
        ...(correlationId && { correlation_id: correlationId }),
        ...(user && typeof user === "object" ? { user } : {}),
        ...(additionalMetadata && typeof additionalMetadata === "object" ? additionalMetadata : {}),
      },
    };

    // Start Vision observation
    return vision.observe(contextConfig, async () => {
      try {
        const visionContext = vision.context();

        // Attach context to Koa context
        (ctx as VisionKoaContext).visionContext = visionContext;

        // Generate and set request ID
        if (config.includeRequestId) {
          const requestId = correlationId || generateRequestId();
          ctx.set(config.requestIdHeader, requestId);
        }

        // Capture initial request metadata
        if (config.captureRequestMetadata) {
          const requestMetadata = extractRequestMetadata(ctx, config);
          vision.merge("request", requestMetadata);
        }

        // Execute downstream middleware
        try {
          await next();

          // Successful request processing
          await handleSuccessfulRequest(ctx, startTime, memoryStart, config);
        } catch (error) {
          // Error during request processing
          await handleRequestError(ctx, error as Error, startTime, memoryStart, config);
          throw error; // Re-throw to maintain Koa error handling flow
        }
      } catch (contextError) {
        // Handle context creation/processing errors
        if (config.errorHandling.captureErrors) {
          const errorMetadata = extractErrorMetadata(contextError as Error, ctx, config);
          vision.merge("error", {
            type: "context_processing_error",
            ...errorMetadata,
          });
        }
        throw contextError;
      }
    });
  };
}

/**
 * Handles successful request completion.
 */
async function handleSuccessfulRequest(
  ctx: Context,
  startTime: number,
  memoryStart: NodeJS.MemoryUsage | undefined,
  config: Required<VisionKoaOptions>,
) {
  try {
    // Capture response metadata
    if (config.captureResponseMetadata) {
      const responseMetadata = extractResponseMetadata(ctx, startTime, config);
      vision.merge("response", responseMetadata);
    }

    // Track performance metrics
    if (config.performance.trackExecutionTime) {
      const executionTime = Date.now() - startTime;
      vision.set("execution_time_ms", executionTime);

      // Mark slow operations
      const threshold = config.performance.slowOperationThreshold ?? 1000;
      if (isSlowOperation(executionTime, threshold)) {
        vision.set("slow_operation", true);
        vision.set("slow_operation_threshold_ms", threshold);
      }
    }

    // Track memory usage
    if (config.performance.trackMemoryUsage && memoryStart) {
      const memoryEnd = process.memoryUsage();
      const memoryDelta = {
        rss: memoryEnd.rss - memoryStart.rss,
        heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
        heapTotal: memoryEnd.heapTotal - memoryStart.heapTotal,
        external: memoryEnd.external - memoryStart.external,
      };
      vision.set("memory_usage_delta", memoryDelta);
    }

    // Mark as successful
    vision.set("success", true);
  } catch (error) {
    // Handle response processing errors
    if (config.errorHandling.captureErrors) {
      const errorMetadata = extractErrorMetadata(error as Error, ctx, config);
      vision.merge("error", {
        type: "response_processing_error",
        ...errorMetadata,
      });
    }
  }
}

/**
 * Handles request errors.
 */
async function handleRequestError(
  ctx: Context,
  error: Error,
  startTime: number,
  memoryStart: NodeJS.MemoryUsage | undefined,
  config: Required<VisionKoaOptions>,
) {
  if (!config.errorHandling.captureErrors) {
    return;
  }

  try {
    // Capture error metadata
    const errorMetadata = extractErrorMetadata(error, ctx, config);
    vision.merge("error", errorMetadata);

    // Track performance even for errors
    if (config.performance.trackExecutionTime) {
      const executionTime = Date.now() - startTime;
      vision.set("execution_time_ms", executionTime);
    }

    // Track memory usage even for errors
    if (config.performance.trackMemoryUsage && memoryStart) {
      const memoryEnd = process.memoryUsage();
      const memoryDelta = {
        rss: memoryEnd.rss - memoryStart.rss,
        heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
        heapTotal: memoryEnd.heapTotal - memoryStart.heapTotal,
        external: memoryEnd.external - memoryStart.external,
      };
      vision.set("memory_usage_delta", memoryDelta);
    }

    // Mark as failed
    vision.set("success", false);
  } catch (processingError) {
    // Log error processing errors, but don't throw
    console.warn("[Vision] Error processing error context:", processingError);
  }
}

/**
 * Creates a minimal Vision middleware with basic functionality.
 */
export function createMinimalVisionMiddleware(
  options: Partial<VisionKoaOptions> = {},
): VisionKoaMiddleware {
  const minimalOptions: VisionKoaOptions = {
    ...options,
    captureHeaders: options.captureHeaders ?? false,
    captureBody: options.captureBody ?? false,
    captureQuery: options.captureQuery ?? true,
    captureParams: options.captureParams ?? true,
    captureKoaMetadata: options.captureKoaMetadata ?? false,
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 2000,
      trackMemoryUsage: false,
      ...options.performance,
    },
  };

  return createVisionMiddleware(minimalOptions);
}

/**
 * Creates a comprehensive Vision middleware with all features enabled.
 */
export function createComprehensiveVisionMiddleware(
  options: Partial<VisionKoaOptions> = {},
): VisionKoaMiddleware {
  const comprehensiveOptions: VisionKoaOptions = {
    ...options,
    captureHeaders: options.captureHeaders ?? true,
    captureBody: options.captureBody ?? true,
    captureQuery: options.captureQuery ?? true,
    captureParams: options.captureParams ?? true,
    captureKoaMetadata: options.captureKoaMetadata ?? true,
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 500,
      trackMemoryUsage: true,
      ...options.performance,
    },
    errorHandling: {
      captureErrors: true,
      captureStackTrace: true,
      ...options.errorHandling,
    },
  };

  return createVisionMiddleware(comprehensiveOptions);
}

/**
 * Creates a performance-optimized Vision middleware.
 */
export function createPerformanceVisionMiddleware(
  options: Partial<VisionKoaOptions> = {},
): VisionKoaMiddleware {
  const performanceOptions: VisionKoaOptions = {
    ...options,
    captureHeaders: options.captureHeaders ?? false,
    captureBody: options.captureBody ?? false,
    captureQuery: options.captureQuery ?? false,
    captureParams: options.captureParams ?? true,
    captureKoaMetadata: options.captureKoaMetadata ?? false,
    redactSensitiveData: options.redactSensitiveData ?? false,
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 100,
      trackMemoryUsage: false,
      ...options.performance,
    },
  };

  return createVisionMiddleware(performanceOptions);
}

/**
 * Creates a secure Vision middleware with enhanced security features.
 */
export function createSecureVisionMiddleware(
  options: Partial<VisionKoaOptions> = {},
): VisionKoaMiddleware {
  const secureOptions: VisionKoaOptions = {
    ...options,
    captureHeaders: options.captureHeaders ?? true,
    captureBody: options.captureBody ?? false, // Never capture body for security
    captureQuery: options.captureQuery ?? true,
    captureParams: options.captureParams ?? true,
    redactSensitiveData: true, // Always redact
    redactHeaders: [
      ...DEFAULT_VISION_KOA_OPTIONS.redactHeaders,
      "x-forwarded-for",
      "x-real-ip",
      "x-client-ip",
      ...(options.redactHeaders || []),
    ],
    redactQueryParams: [
      ...DEFAULT_VISION_KOA_OPTIONS.redactQueryParams,
      "access_token",
      "refresh_token",
      "session_id",
      ...(options.redactQueryParams || []),
    ],
    errorHandling: {
      captureErrors: true,
      captureStackTrace: false, // Never expose stack traces
      transformError: (error, ctx) => ({
        name: "Error",
        message: "An error occurred",
        status: (error as any).status || 500,
        // Don't expose internal error details
      }),
      ...options.errorHandling,
    },
  };

  return createVisionMiddleware(secureOptions);
}
