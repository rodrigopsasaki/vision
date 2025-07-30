import type { Context } from "koa";
import micromatch from "micromatch";

import type {
  RequestMetadata,
  ResponseMetadata,
  ErrorMetadata,
  VisionKoaOptions,
} from "./types";

/**
 * Redacts sensitive data from an object based on the provided field names.
 */
function redactObject(
  obj: Record<string, unknown>,
  fieldsToRedact: string[],
): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return obj;
  
  const redacted = { ...obj };
  for (const field of fieldsToRedact) {
    if (field in redacted) {
      redacted[field] = "[REDACTED]";
    }
  }
  return redacted;
}

/**
 * Safely gets nested object properties.
 */
function safeGet(obj: any, path: string, defaultValue: any = undefined): any {
  try {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Checks if a route should be excluded based on patterns.
 */
export function isRouteExcluded(path: string, excludePatterns: string[]): boolean {
  if (!excludePatterns.length) return false;
  return micromatch.isMatch(path, excludePatterns);
}

/**
 * Extracts request metadata based on the provided options.
 */
export function extractRequestMetadata(
  ctx: Context,
  options: Required<VisionKoaOptions>,
): RequestMetadata {
  const metadata: RequestMetadata = {
    method: ctx.method,
    url: ctx.url,
  };

  // Basic request info
  if (options.captureRequestMetadata) {
    metadata.path = ctx.path;
    metadata.originalUrl = ctx.originalUrl;
  }

  // IP address
  if (options.captureIp) {
    metadata.ip = ctx.ip || safeGet(ctx, 'request.socket.remoteAddress');
  }

  // User agent
  if (options.captureUserAgent) {
    metadata.userAgent = ctx.headers["user-agent"];
  }

  // Headers
  if (options.captureHeaders) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(ctx.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(", ");
      }
    }

    if (options.redactSensitiveData) {
      metadata.headers = redactObject(headers, options.redactHeaders) as Record<string, string>;
    } else {
      metadata.headers = headers;
    }
  }

  // Query parameters
  if (options.captureQuery && ctx.query) {
    if (options.redactSensitiveData) {
      metadata.query = redactObject(ctx.query as Record<string, unknown>, options.redactQueryParams);
    } else {
      metadata.query = ctx.query;
    }
  }

  // Route parameters (from ctx.params if using koa-router)
  if (options.captureParams && (ctx as any).params) {
    metadata.params = (ctx as any).params;
  }

  // Request body
  if (options.captureBody && ctx.method !== "GET" && (ctx.request as any).body) {
    const body = (ctx.request as any).body;
    if (options.redactSensitiveData && typeof body === 'object' && body !== null) {
      metadata.body = redactObject(body, options.redactBodyFields);
    } else {
      metadata.body = body;
    }
  }

  // Correlation ID
  const correlationId = options.extractCorrelationId(ctx);
  if (correlationId) {
    metadata.correlationId = correlationId;
  }

  // User information
  const user = options.extractUser(ctx);
  if (user) {
    metadata.user = user;
  }

  // Tenant information
  const tenant = options.extractTenant(ctx);
  if (tenant) {
    metadata.tenant = tenant;
  }

  // Koa-specific metadata
  if (options.captureKoaMetadata) {
    metadata.koa = {
      state: ctx.state,
      cookies: getCookiesAsObject(ctx),
      secure: ctx.secure,
      fresh: ctx.fresh,
      stale: ctx.stale,
    };
  }

  return metadata;
}

/**
 * Extracts response metadata.
 */
export function extractResponseMetadata(
  ctx: Context,
  startTime: number,
  options: Required<VisionKoaOptions>,
): ResponseMetadata {
  const endTime = Date.now();
  const duration = endTime - startTime;

  const metadata: ResponseMetadata = {
    status: ctx.status,
    duration,
  };

  // Status text
  metadata.statusText = getStatusText(ctx.status);

  // Timing information
  if (options.captureTiming) {
    metadata.timing = {
      startTime,
      endTime,
      duration,
    };
  }

  // Response headers
  if (options.captureResponseMetadata) {
    try {
      metadata.headers = ctx.response.headers as Record<string, string>;
    } catch {
      metadata.headers = {};
    }
  }

  // Response body (be careful with large responses)
  if (options.captureResponseMetadata && ctx.body && shouldCaptureResponseBody(ctx)) {
    metadata.body = ctx.body;
  }

  // Response length
  if (ctx.length) {
    metadata.length = ctx.length;
  }

  // Koa-specific response metadata
  if (options.captureKoaMetadata) {
    metadata.koa = {
      respond: ctx.respond,
      writable: ctx.writable,
    };
  }

  return metadata;
}

/**
 * Extracts error metadata.
 */
export function extractErrorMetadata(
  error: Error,
  ctx: Context,
  options: Required<VisionKoaOptions>,
): ErrorMetadata {
  const metadata: ErrorMetadata = {
    name: error.name,
    message: error.message,
  };

  // Stack trace (configurable)
  if (options.errorHandling.captureStackTrace) {
    metadata.stack = error.stack;
  }

  // Error code
  if ((error as any).code) {
    metadata.code = (error as any).code;
  }

  // HTTP status
  if ((error as any).status) {
    metadata.status = (error as any).status;
  }

  // Expose flag (Koa-specific)
  if ((error as any).expose !== undefined) {
    metadata.expose = (error as any).expose;
  }

  // Koa-specific error metadata
  metadata.koa = {
    status: (error as any).status,
    expose: (error as any).expose,
  };

  // Apply custom error transformation
  if (options.errorHandling.transformError) {
    const transformed = options.errorHandling.transformError(error, ctx);
    Object.assign(metadata, transformed);
  }

  return metadata;
}

/**
 * Gets HTTP status text for a status code.
 */
function getStatusText(status: number): string {
  const messages: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };

  return messages[status] || "Unknown Status";
}

/**
 * Gets cookies as a plain object.
 */
function getCookiesAsObject(ctx: Context): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  try {
    // Koa cookies API
    if (ctx.cookies && typeof ctx.cookies.get === 'function') {
      // This is a simplified approach - in practice, you'd iterate through known cookies
      const cookieHeader = ctx.headers.cookie;
      if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
          const [name, ...rest] = cookie.trim().split('=');
          if (name && rest.length > 0) {
            cookies[name] = rest.join('=');
          }
        });
      }
    }
  } catch {
    // Ignore cookie extraction errors
  }

  return cookies;
}

/**
 * Determines if response body should be captured.
 */
function shouldCaptureResponseBody(ctx: Context): boolean {
  // Don't capture large responses
  if (ctx.length && ctx.length > 10000) {
    return false;
  }

  // Don't capture binary responses
  const contentType = ctx.type;
  if (contentType && (
    contentType.includes('image/') ||
    contentType.includes('video/') ||
    contentType.includes('audio/') ||
    contentType.includes('application/octet-stream')
  )) {
    return false;
  }

  return true;
}

/**
 * Checks if an operation is considered slow.
 */
export function isSlowOperation(duration: number, threshold: number): boolean {
  return duration > threshold;
}

/**
 * Generates a unique request ID.
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Merges user options with default options.
 */
export function mergeOptions(
  userOptions: Partial<VisionKoaOptions> = {},
): Required<VisionKoaOptions> {
  const defaultOptions = {
    enabled: true,
    excludeRoutes: ["/health", "/metrics", "/status", "/ping", "/favicon.ico"],
    captureRequestMetadata: true,
    captureResponseMetadata: true,
    captureHeaders: true,
    captureBody: false,
    captureQuery: true,
    captureParams: true,
    captureUserAgent: true,
    captureIp: true,
    captureTiming: true,
    captureKoaMetadata: true,

    contextNameGenerator: userOptions.contextNameGenerator ?? ((ctx) => 
      `${ctx.method.toLowerCase()}.${ctx.path}`
    ),

    shouldExcludeRoute: userOptions.shouldExcludeRoute ?? ((ctx) => {
      const path = ctx.path.toLowerCase();
      return (
        path.includes("/health") ||
        path.includes("/metrics") ||
        path.includes("/status") ||
        path.includes("/ping") ||
        path.includes("/favicon.ico")
      );
    }),

    extractMetadata: userOptions.extractMetadata ?? (() => ({})),

    extractUser: userOptions.extractUser ?? ((ctx) => {
      return (ctx as any).user || 
             (ctx as any).state?.user ||
             ctx.headers["x-user-id"] ||
             ctx.headers["x-user"] ||
             undefined;
    }),

    extractCorrelationId: userOptions.extractCorrelationId ?? ((ctx) => {
      return (
        ctx.headers["x-correlation-id"] as string ||
        ctx.headers["x-request-id"] as string ||
        ctx.headers["x-trace-id"] as string ||
        ctx.headers["x-transaction-id"] as string
      );
    }),

    extractTenant: userOptions.extractTenant ?? (() => undefined),

    includeRequestId: userOptions.includeRequestId ?? true,
    requestIdHeader: userOptions.requestIdHeader ?? "X-Request-ID",

    redactSensitiveData: userOptions.redactSensitiveData ?? true,
    redactHeaders: userOptions.redactHeaders ?? [
      "authorization",
      "cookie",
      "x-api-key",
      "x-auth-token",
      "x-session-token",
      "x-csrf-token"
    ],
    redactQueryParams: userOptions.redactQueryParams ?? [
      "token",
      "key",
      "secret",
      "password",
      "auth",
      "api_key"
    ],
    redactBodyFields: userOptions.redactBodyFields ?? [
      "password",
      "ssn",
      "credit_card",
      "creditCard",
      "secret",
      "api_key",
      "apiKey",
      "private_key",
      "privateKey"
    ],

    correlationIdHeaders: userOptions.correlationIdHeaders ?? [
      "x-correlation-id",
      "x-request-id",
      "x-trace-id",
      "x-transaction-id",
      "correlation-id",
      "request-id"
    ],

    performance: {
      trackExecutionTime: userOptions.performance?.trackExecutionTime ?? true,
      slowOperationThreshold: userOptions.performance?.slowOperationThreshold ?? 1000,
      trackMemoryUsage: userOptions.performance?.trackMemoryUsage ?? false,
    },

    errorHandling: {
      captureErrors: userOptions.errorHandling?.captureErrors ?? true,
      captureStackTrace: userOptions.errorHandling?.captureStackTrace ?? (process.env.NODE_ENV !== "production"),
      transformError: userOptions.errorHandling?.transformError ?? ((error, ctx) => ({
        name: error.name,
        message: error.message,
        ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
        status: (error as any).status,
        code: (error as any).code,
        expose: (error as any).expose,
      })),
    },
  };

  return {
    ...defaultOptions,
    ...userOptions,
    performance: {
      ...defaultOptions.performance,
      ...userOptions.performance,
    },
    errorHandling: {
      ...defaultOptions.errorHandling,
      ...userOptions.errorHandling,
    },
  };
}