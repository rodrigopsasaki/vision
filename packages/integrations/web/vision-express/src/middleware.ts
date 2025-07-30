import { vision } from "@rodrigopsasaki/vision";
import type { NextFunction } from "express";

import type { VisionExpressOptions, VisionRequest, VisionResponse } from "./types";
import { DEFAULT_VISION_EXPRESS_OPTIONS } from "./types";

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
 * // Basic usage - just works out of the box
 * app.use(createVisionMiddleware());
 * 
 * // Advanced usage with custom options
 * app.use(createVisionMiddleware({
 *   captureBody: true,
 *   excludeRoutes: ["/health", "/metrics"],
 *   extractUser: (req) => req.user,
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
export function createVisionMiddleware(options: VisionExpressOptions = {}) {
  const config = { ...DEFAULT_VISION_EXPRESS_OPTIONS, ...options };

  return (req: VisionRequest, res: VisionResponse, next: NextFunction) => {
    // Skip if disabled or excluded route
    if (!config.enabled || shouldExcludeRoute(req, config.excludeRoutes)) {
      return next();
    }

    const startTime = Date.now();
    const contextName = `api.${req.method.toLowerCase()}.${req.path}`;

    // Extract correlation ID using smart defaults
    const correlationId = extractCorrelationId(req, config.correlationIdHeaders);

    // Extract user using smart defaults
    const user = config.extractUser(req);

    // Extract request metadata
    const requestMetadata = extractRequestMetadata(req, config);

    // Create initial data for the context
    const initialData: Record<string, unknown> = {
      service: "vision-express",
      timestamp: new Date().toISOString(),
      request: requestMetadata,
    };

    // Add correlation ID if found
    if (correlationId) {
      initialData.correlationId = correlationId;
    }

    // Add user if found
    if (user) {
      initialData.user = user;
    }

    // Create and execute the Vision context
    vision.observe(
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
        if (config.includeRequestId) {
          res.set(config.requestIdHeader, req.visionContext.id);
        }

        // Capture response metadata on finish
        const originalEnd = res.end;
        res.end = function(chunk?: any, encoding?: any, cb?: any) {
          const responseMetadata = extractResponseMetadata(res, startTime);
          vision.set("response", responseMetadata);
          return originalEnd.call(this, chunk, encoding, cb);
        };

        // Execute the rest of the middleware chain
        next();
      }
    );
  };
}

/**
 * Simple one-liner middleware - just works out of the box.
 * 
 * This is the recommended default middleware for most applications.
 * 
 * @param options - Optional configuration overrides
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { visionMiddleware } from '@rodrigopsasaki/vision-express';
 * 
 * const app = express();
 * app.use(visionMiddleware());
 * ```
 */
export function visionMiddleware(options: VisionExpressOptions = {}) {
  return createVisionMiddleware(options);
}

/**
 * Creates a minimal Vision middleware with no Express metadata capture.
 * 
 * Perfect for when you want Vision context but no Express metadata clutter.
 * 
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createMinimalVisionMiddleware } from '@rodrigopsasaki/vision-express';
 * 
 * const app = express();
 * app.use(createMinimalVisionMiddleware());
 * ```
 */
export function createMinimalVisionMiddleware() {
  return createVisionMiddleware({
    captureHeaders: false,
    captureQueryParams: false,
    captureBody: false,
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
    captureHeaders: true,
    captureQueryParams: true,
    captureBody: true,
  });
}

/**
 * Creates a secure Vision middleware with extra security redaction.
 * 
 * Perfect for high-security applications with extra protection.
 * 
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { createSecureVisionMiddleware } from '@rodrigopsasaki/vision-express';
 * 
 * const app = express();
 * app.use(createSecureVisionMiddleware());
 * ```
 */
export function createSecureVisionMiddleware() {
  return createVisionMiddleware({
    captureHeaders: false,
    captureQueryParams: false,
    captureBody: false,
    redactHeaders: [...DEFAULT_VISION_EXPRESS_OPTIONS.redactHeaders, "x-forwarded-for", "x-real-ip"],
    redactQueryParams: [...DEFAULT_VISION_EXPRESS_OPTIONS.redactQueryParams, "session", "sid"],
    redactBodyFields: [...DEFAULT_VISION_EXPRESS_OPTIONS.redactBodyFields, "session", "sid"],
  });
}

// Helper functions
function shouldExcludeRoute(req: VisionRequest, excludeRoutes: string[]): boolean {
  const path = req.path.toLowerCase();
  return excludeRoutes.some(route => path.includes(route.toLowerCase()));
}

function extractCorrelationId(req: VisionRequest, headers: string[]): string | undefined {
  for (const header of headers) {
    const value = req.headers[header] as string;
    if (value) return value;
  }
  return undefined;
}

function extractRequestMetadata(req: VisionRequest, config: Required<VisionExpressOptions>) {
  const metadata: Record<string, unknown> = {
    method: req.method,
    path: req.path,
  };

  // Capture headers if enabled
  if (config.captureHeaders) {
    const headers: Record<string, string> = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      if (config.redactHeaders.includes(key.toLowerCase())) {
        headers[key] = "[REDACTED]";
      } else {
        headers[key] = Array.isArray(value) ? value.join(", ") : String(value || "");
      }
    });
    metadata.headers = headers;
  }

  // Capture query params if enabled
  if (config.captureQueryParams) {
    const query: Record<string, string> = {};
    Object.entries(req.query).forEach(([key, value]) => {
      if (config.redactQueryParams.includes(key.toLowerCase())) {
        query[key] = "[REDACTED]";
      } else {
        query[key] = Array.isArray(value) ? value.join(", ") : String(value || "");
      }
    });
    metadata.query = query;
  }

  // Capture body if enabled
  if (config.captureBody && req.body) {
    metadata.body = req.body;
  }

  return metadata;
}

function extractResponseMetadata(res: VisionResponse, startTime: number) {
  return {
    statusCode: res.statusCode,
    headers: res.getHeaders(),
    duration: Date.now() - startTime,
  };
} 