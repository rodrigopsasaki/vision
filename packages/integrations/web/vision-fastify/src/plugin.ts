import { vision } from "@rodrigopsasaki/vision";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

import type {
  VisionFastifyOptions,
  VisionFastifyPluginOptions,
  VisionFastifyRequest,
  VisionFastifyReply,
} from "./types";
import { DEFAULT_VISION_FASTIFY_OPTIONS } from "./types";
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
 * High-performance Fastify plugin for Vision observability.
 *
 * This plugin provides comprehensive observability integration for Fastify applications:
 * - Automatic context creation and propagation
 * - Request/response metadata capture
 * - Performance tracking with slow operation detection
 * - Error tracking with detailed context
 * - Custom extractors for user, correlation, and business data
 * - Security-aware data redaction
 * - Route-level configuration via options
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { visionPlugin } from '@rodrigopsasaki/vision-fastify';
 *
 * const fastify = Fastify();
 *
 * // Register the Vision plugin
 * await fastify.register(visionPlugin, {
 *   captureBody: true,
 *   performance: {
 *     slowOperationThreshold: 500
 *   },
 *   extractUser: (request) => request.headers['x-user-id']
 * });
 *
 * fastify.get('/users/:id', async (request, reply) => {
 *   // Access the Vision context
 *   const ctx = request.visionContext;
 *
 *   // Add custom data to the context
 *   vision.set('user_id', request.params.id);
 *   vision.set('operation', 'get_user');
 *
 *   // Your route logic here...
 *   const user = await getUser(request.params.id);
 *   return user;
 * });
 * ```
 */
const visionPluginInternal: FastifyPluginAsync<VisionFastifyPluginOptions> = async (
  fastify: FastifyInstance,
  options: VisionFastifyPluginOptions = {},
) => {
  const config = mergeOptions(options);

  // Skip if disabled
  if (!config.enabled) {
    return;
  }

  // Add Vision context to request and reply decorators
  fastify.decorateRequest("visionContext", null);
  fastify.decorateReply("visionContext", null);

  // Pre-handler hook for request processing
  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if this route should be excluded
    if (config.shouldExcludeRoute(request) || isRouteExcluded(request.url, config.excludeRoutes)) {
      return;
    }

    const startTime = Date.now();
    const memoryStart = config.performance.trackMemoryUsage ? process.memoryUsage() : undefined;

    // Generate context configuration
    const contextName = config.contextNameGenerator(request);
    const correlationId = config.extractCorrelationId(request);
    const user = config.extractUser(request);
    const additionalMetadata = config.extractMetadata(request);

    // Create Vision context
    const contextConfig = {
      name: contextName,
      scope: "http",
      source: "fastify",
      initial: {
        timestamp: new Date().toISOString(),
        execution_context: "fastify",
        method: request.method,
        url: request.url,
        route: (request as any).routeOptions?.url,
        ...(correlationId && { correlation_id: correlationId }),
        ...(user && typeof user === "object" ? { user } : {}),
        ...(additionalMetadata && typeof additionalMetadata === "object" ? additionalMetadata : {}),
      },
    };

    // Start Vision observation
    return new Promise<void>((resolve, reject) => {
      vision.observe(contextConfig, async () => {
        try {
          const visionContext = vision.context();

          // Attach context to request and reply
          (request as VisionFastifyRequest).visionContext = visionContext;
          (reply as VisionFastifyReply).visionContext = visionContext;

          // Generate and set request ID
          if (config.includeRequestId) {
            const requestId = correlationId || generateRequestId();
            reply.header(config.requestIdHeader, requestId);
          }

          // Capture initial request metadata
          if (config.captureRequestMetadata) {
            const requestMetadata = extractRequestMetadata(request, config);
            vision.merge("request", requestMetadata);
          }

          // Store timing information for later use
          (request as any).__visionStartTime = startTime;
          (request as any).__visionMemoryStart = memoryStart;

          resolve();
        } catch (error) {
          // Handle context creation errors
          if (config.errorHandling.captureErrors) {
            const errorMetadata = extractErrorMetadata(error as Error, request, config);
            vision.merge("error", {
              type: "context_creation_error",
              ...errorMetadata,
            });
          }
          reject(error);
        }
      });
    });
  });

  // Response hook for capturing response metadata
  fastify.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload) => {
    // Skip if no Vision context (excluded route)
    const visionContext = (request as VisionFastifyRequest).visionContext;
    if (!visionContext) {
      return payload;
    }

    try {
      const startTime = (request as any).__visionStartTime ?? Date.now();
      const memoryStart = (request as any).__visionMemoryStart;

      // Capture response metadata
      if (config.captureResponseMetadata) {
        const responseMetadata = extractResponseMetadata(reply, startTime, config);
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

      return payload;
    } catch (error) {
      // Handle response processing errors
      if (config.errorHandling.captureErrors) {
        const errorMetadata = extractErrorMetadata(error as Error, request, config);
        vision.merge("error", {
          type: "response_processing_error",
          ...errorMetadata,
        });
      }

      return payload;
    }
  });

  // Error hook for capturing error metadata
  fastify.addHook("onError", async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    // Skip if no Vision context (excluded route)
    const visionContext = (request as VisionFastifyRequest).visionContext;
    if (!visionContext || !config.errorHandling.captureErrors) {
      return;
    }

    try {
      const startTime = (request as any).__visionStartTime ?? Date.now();
      const memoryStart = (request as any).__visionMemoryStart;

      // Capture error metadata
      const errorMetadata = extractErrorMetadata(error, request, config);
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
  });

  // Note: Route-level configuration can be added via custom route schemas
  // if needed in future versions
};

/**
 * Vision Fastify plugin with proper plugin metadata.
 */
export const visionPlugin = fp(visionPluginInternal, {
  name: "vision",
  fastify: "4.x || 5.x",
});

/**
 * Creates a minimal Vision plugin with basic functionality.
 */
export function createMinimalVisionPlugin(options: Partial<VisionFastifyOptions> = {}) {
  const minimalOptions: VisionFastifyOptions = {
    ...options,
    captureHeaders: options.captureHeaders ?? false,
    captureBody: options.captureBody ?? false,
    captureQuery: options.captureQuery ?? true,
    captureParams: options.captureParams ?? true,
    captureFastifyMetadata: options.captureFastifyMetadata ?? false,
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 2000,
      trackMemoryUsage: false,
      ...options.performance,
    },
  };

  return fp(
    async (fastify: FastifyInstance) => {
      await visionPluginInternal(fastify, minimalOptions);
    },
    {
      name: "vision-minimal",
      fastify: "4.x || 5.x",
    },
  );
}

/**
 * Creates a comprehensive Vision plugin with all features enabled.
 */
export function createComprehensiveVisionPlugin(options: Partial<VisionFastifyOptions> = {}) {
  const comprehensiveOptions: VisionFastifyOptions = {
    ...options,
    captureHeaders: options.captureHeaders ?? true,
    captureBody: options.captureBody ?? true,
    captureQuery: options.captureQuery ?? true,
    captureParams: options.captureParams ?? true,
    captureFastifyMetadata: options.captureFastifyMetadata ?? true,
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

  return fp(
    async (fastify: FastifyInstance) => {
      await visionPluginInternal(fastify, comprehensiveOptions);
    },
    {
      name: "vision-comprehensive",
      fastify: "4.x || 5.x",
    },
  );
}

/**
 * Creates a performance-optimized Vision plugin.
 */
export function createPerformanceVisionPlugin(options: Partial<VisionFastifyOptions> = {}) {
  const performanceOptions: VisionFastifyOptions = {
    ...options,
    captureHeaders: options.captureHeaders ?? false,
    captureBody: options.captureBody ?? false,
    captureQuery: options.captureQuery ?? false,
    captureParams: options.captureParams ?? true,
    captureFastifyMetadata: options.captureFastifyMetadata ?? false,
    redactSensitiveData: options.redactSensitiveData ?? false,
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 100,
      trackMemoryUsage: false,
      ...options.performance,
    },
  };

  return fp(
    async (fastify: FastifyInstance) => {
      await visionPluginInternal(fastify, performanceOptions);
    },
    {
      name: "vision-performance",
      fastify: "4.x || 5.x",
    },
  );
}
