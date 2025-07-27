import { vision } from "@rodrigopsasaki/vision";
import type { NextFunction } from "express";

import type { VisionExpressOptions, VisionRequest, VisionResponse } from "./types";
import { extractRequestMetadata, extractResponseMetadata, extractErrorMetadata, mergeOptions } from "./utils";

// Re-export types for convenience
export type { VisionRequest, VisionResponse, VisionExpressOptions };

/**
 * Creates a Vision Express middleware that automatically creates contexts for HTTP requests.
 * 
 * This middleware wraps each request in a Vision context, automatically capturing
 * request/response metadata and providing easy access to the context throughout
 * the request lifecycle.
 * 
 * @param options - Configuration options for the middleware
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createVisionMiddleware } from '@rodrigopsasaki/vision-express';
 * 
 * const app = express();
 * 
 * // Basic usage
 * app.use(createVisionMiddleware());
 * 
 * // Advanced usage with custom options
 * app.use(createVisionMiddleware({
 *   captureBody: true,
 *   contextNameGenerator: (req) => `api.${req.method}.${req.path}`,
 *   extractUser: (req) => req.user,
 *   shouldExcludeRoute: (req) => req.path.startsWith('/health'),
 * }));
 * 
 * app.get('/users/:id', async (req, res) => {
 *   // Access the Vision context
 *   const ctx = req.visionContext;
 *   
 *   // Add custom data to the context
 *   vision.set('user_id', req.params.id);
 *   vision.set('operation', 'get_user');
 *   
 *   // Your route logic here...
 *   const user = await getUser(req.params.id);
 *   res.json(user);
 * });
 * ```
 */
export function createVisionMiddleware(options: Partial<VisionExpressOptions> = {}) {
  const config = mergeOptions(options);

  return async (req: VisionRequest, res: VisionResponse, next: NextFunction) => {
    // Skip Vision tracking for excluded routes
    if (config.shouldExcludeRoute(req)) {
      return next();
    }

    const startTime = Date.now();
    const contextName = config.contextNameGenerator(req);

    try {
      // Extract initial metadata
      const requestMetadata = config.captureRequestMetadata 
        ? extractRequestMetadata(req, config) 
        : undefined;

      const customMetadata = config.extractMetadata(req);

      // Create initial data for the context
      const initialData: Record<string, unknown> = {
        ...customMetadata,
      };

      if (requestMetadata) {
        initialData.request = requestMetadata;
      }

      // Create and execute the Vision context
      await vision.observe(
        {
          name: contextName,
          scope: "http",
          source: "express",
          initial: initialData,
        },
        async () => {
          // Store the context on the request and response objects
          req.visionContext = vision.context();
          res.visionContext = vision.context();

          // Add request ID to response headers if configured
          if (config.includeRequestIdInResponse) {
            res.set(config.requestIdHeader, req.visionContext.id);
          }

          // Capture response metadata on finish
          const originalEnd = res.end;
          res.end = function(chunk?: any, encoding?: any, cb?: any) {
            if (config.captureResponseMetadata) {
              const responseMetadata = extractResponseMetadata(res, startTime);
              vision.set("response", responseMetadata);
            }
            return originalEnd.call(this, chunk, encoding, cb);
          };

          // Handle errors - originalError is used in the Promise below

          // Execute the rest of the middleware chain
          return new Promise<void>((resolve, reject) => {
            const originalNext = next;
            const wrappedNext = (error?: unknown) => {
              if (error) {
                if (config.captureErrors) {
                  const errorMetadata = extractErrorMetadata(error);
                  vision.set("error", errorMetadata);
                }
                reject(error);
              } else {
                resolve();
              }
            };

            // Call the original next function with our wrapped version
            originalNext(wrappedNext);
          });
        }
      );
    } catch (error) {
      // If there's an error in the Vision context creation, still call next
      // but log the error
      console.error("[vision-express] Error creating Vision context:", error);
      next();
    }
  };
}

/**
 * Creates a simple Vision middleware with minimal configuration.
 * 
 * This is a convenience function for basic usage scenarios.
 * 
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createSimpleVisionMiddleware } from '@rodrigopsasaki/vision-express';
 * 
 * const app = express();
 * app.use(createSimpleVisionMiddleware());
 * ```
 */
export function createSimpleVisionMiddleware() {
  return createVisionMiddleware({
    captureRequestMetadata: true,
    captureResponseMetadata: true,
    captureHeaders: true,
    captureBody: false,
    captureQuery: true,
    captureParams: true,
    captureUserAgent: true,
    captureIp: true,
    captureTiming: true,
    redactSensitiveData: true,
  });
}

/**
 * Creates a comprehensive Vision middleware that captures all available data.
 * 
 * This middleware captures everything including request bodies, which should
 * be used carefully in production environments.
 * 
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createComprehensiveVisionMiddleware } from '@rodrigopsasaki/vision-express';
 * 
 * const app = express();
 * app.use(createComprehensiveVisionMiddleware());
 * ```
 */
export function createComprehensiveVisionMiddleware() {
  return createVisionMiddleware({
    captureRequestMetadata: true,
    captureResponseMetadata: true,
    captureHeaders: true,
    captureBody: true,
    captureQuery: true,
    captureParams: true,
    captureUserAgent: true,
    captureIp: true,
    captureTiming: true,
    redactSensitiveData: true,
  });
} 