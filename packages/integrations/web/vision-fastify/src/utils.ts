import type { FastifyRequest, FastifyReply } from "fastify";
import micromatch from "micromatch";

import type {
  RequestMetadata,
  ResponseMetadata,
  ErrorMetadata,
  VisionFastifyOptions,
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
export function isRouteExcluded(url: string, excludePatterns: string[]): boolean {
  if (!excludePatterns.length) return false;
  return micromatch.isMatch(url, excludePatterns);
}

/**
 * Extracts request metadata based on the provided options.
 */
export function extractRequestMetadata(
  request: FastifyRequest,
  options: Required<VisionFastifyOptions>,
): RequestMetadata {
  const metadata: RequestMetadata = {
    method: request.method,
    url: request.url,
  };

  // Basic request info
  if (options.captureRequestMetadata) {
    metadata.path = safeGet(request, 'routeOptions.url') || request.url;
  }

  // IP address
  if (options.captureIp) {
    metadata.ip = request.ip || safeGet(request, 'socket.remoteAddress');
  }

  // User agent
  if (options.captureUserAgent) {
    metadata.userAgent = request.headers["user-agent"];
  }

  // Headers
  if (options.captureHeaders) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
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
  if (options.captureQuery && request.query) {
    if (options.redactSensitiveData) {
      metadata.query = redactObject(request.query as Record<string, unknown>, options.redactQueryParams);
    } else {
      metadata.query = (request.query as Record<string, unknown>) || {};
    }
  }

  // Route parameters
  if (options.captureParams && request.params) {
    metadata.params = (request.params as Record<string, unknown>) || {};
  }

  // Request body
  if (options.captureBody && request.method !== "GET" && request.body) {
    if (options.redactSensitiveData) {
      metadata.body = redactObject(request.body as Record<string, unknown>, options.redactBodyFields);
    } else {
      metadata.body = request.body;
    }
  }

  // Correlation ID
  const correlationId = options.extractCorrelationId(request);
  if (correlationId) {
    metadata.correlationId = correlationId;
  }

  // User information
  const user = options.extractUser(request);
  if (user) {
    metadata.user = user;
  }

  // Tenant information
  const tenant = options.extractTenant(request);
  if (tenant) {
    metadata.tenant = tenant;
  }

  // Fastify-specific metadata
  if (options.captureFastifyMetadata) {
    metadata.fastify = {
      routeId: safeGet(request, 'routeOptions.id'),
      routeOptions: safeGet(request, 'routeOptions'),
      validation: safeGet(request, 'validationError'),
    };
  }

  return metadata;
}

/**
 * Extracts response metadata.
 */
export function extractResponseMetadata(
  reply: FastifyReply,
  startTime: number,
  options: Required<VisionFastifyOptions>,
): ResponseMetadata {
  const endTime = Date.now();
  const duration = endTime - startTime;

  const metadata: ResponseMetadata = {
    statusCode: reply.statusCode,
    duration,
  };

  // Status message
  if (reply.statusCode) {
    metadata.statusMessage = getStatusMessage(reply.statusCode);
  }

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
      const headers = reply.getHeaders();
      metadata.headers = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(', ') : String(value || '')
        ])
      );
    } catch {
      // Headers might not be available in all contexts
      metadata.headers = {};
    }
  }

  // Fastify-specific response metadata
  if (options.captureFastifyMetadata) {
    metadata.fastify = {
      serialization: {
        duration: safeGet(reply, 'serializationDuration'),
      },
    };
  }

  return metadata;
}

/**
 * Extracts error metadata.
 */
export function extractErrorMetadata(
  error: Error,
  request: FastifyRequest,
  options: Required<VisionFastifyOptions>,
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

  // HTTP status code
  if ((error as any).statusCode) {
    metadata.statusCode = (error as any).statusCode;
  }

  // Validation errors (Fastify-specific)
  if ((error as any).validation) {
    metadata.validation = (error as any).validation;
  }

  // Fastify-specific error metadata
  if ((error as any).kind) {
    metadata.fastify = {
      kind: (error as any).kind,
      statusCode: (error as any).statusCode,
    };
  }

  // Apply custom error transformation
  if (options.errorHandling.transformError) {
    const transformed = options.errorHandling.transformError(error, request);
    Object.assign(metadata, transformed);
  }

  return metadata;
}

/**
 * Gets HTTP status message for a status code.
 */
function getStatusMessage(statusCode: number): string {
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

  return messages[statusCode] || "Unknown Status";
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
  userOptions: Partial<VisionFastifyOptions> = {},
): Required<VisionFastifyOptions> {
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
    captureFastifyMetadata: true,

    contextNameGenerator: userOptions.contextNameGenerator ?? ((request) => 
      `${request.method.toLowerCase()}.${safeGet(request, 'routeOptions.url') || request.url}`
    ),

    shouldExcludeRoute: userOptions.shouldExcludeRoute ?? ((request) => {
      const url = request.url.toLowerCase();
      return (
        url.includes("/health") ||
        url.includes("/metrics") ||
        url.includes("/status") ||
        url.includes("/ping") ||
        url.includes("/favicon.ico")
      );
    }),

    extractMetadata: userOptions.extractMetadata ?? (() => ({})),

    extractUser: userOptions.extractUser ?? ((request) => {
      return (request as any).user || 
             (request as any).session?.user ||
             request.headers["x-user-id"] ||
             request.headers["x-user"] ||
             undefined;
    }),

    extractCorrelationId: userOptions.extractCorrelationId ?? ((request) => {
      return (
        request.headers["x-correlation-id"] as string ||
        request.headers["x-request-id"] as string ||
        request.headers["x-trace-id"] as string ||
        request.headers["x-transaction-id"] as string
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
      transformError: userOptions.errorHandling?.transformError ?? ((error, request) => ({
        name: error.name,
        message: error.message,
        ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
        statusCode: (error as any).statusCode,
        code: (error as any).code,
        validation: (error as any).validation,
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