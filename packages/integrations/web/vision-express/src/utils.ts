import type { Request } from "express";

import type {
  RequestMetadata,
  ResponseMetadata,
  ErrorMetadata,
  VisionExpressOptions,
} from "./types";

/**
 * Redacts sensitive data from an object based on the provided field names.
 */
function redactObject(
  obj: Record<string, unknown>,
  fieldsToRedact: string[],
): Record<string, unknown> {
  const redacted = { ...obj };
  for (const field of fieldsToRedact) {
    if (field in redacted) {
      redacted[field] = "[REDACTED]";
    }
  }
  return redacted;
}

/**
 * Extracts request metadata based on the provided options.
 */
export function extractRequestMetadata(
  req: Request,
  options: Required<VisionExpressOptions>,
): RequestMetadata {
  const metadata: RequestMetadata = {
    method: req.method,
    url: req.url,
    path: req.path,
    protocol: req.protocol,
  };

  if (options.captureIp) {
    metadata.ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  }

  if (options.captureUserAgent) {
    metadata.userAgent = req.get("User-Agent");
  }

  if (options.captureHeaders) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(", ");
      }
    }

    if (options.redactSensitiveData) {
      metadata.headers = redactObject(headers, options.redactedHeaders) as Record<string, string>;
    } else {
      metadata.headers = headers;
    }
  }

  if (options.captureQuery && req.query) {
    if (options.redactSensitiveData) {
      metadata.query = redactObject(
        req.query as Record<string, unknown>,
        options.redactedQueryParams,
      );
    } else {
      metadata.query = req.query;
    }
  }

  if (options.captureParams && req.params) {
    metadata.params = req.params;
  }

  if (options.captureBody && req.method !== "GET" && req.body) {
    if (options.redactSensitiveData) {
      metadata.body = redactObject(req.body, options.redactedBodyFields);
    } else {
      metadata.body = req.body;
    }
  }

  if (options.extractCorrelationId) {
    metadata.correlationId = options.extractCorrelationId(req);
  }

  if (options.extractUser) {
    metadata.user = options.extractUser(req);
  }

  if (options.extractTenant) {
    metadata.tenant = options.extractTenant(req);
  }

  return metadata;
}

/**
 * Extracts response metadata from the response object.
 */
export function extractResponseMetadata(res: any, startTime: number): ResponseMetadata {
  const endTime = Date.now();
  const duration = endTime - startTime;

  const metadata: ResponseMetadata = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage || getStatusMessage(res.statusCode),
    duration,
    timing: {
      startTime,
      endTime,
      duration,
    },
  };

  // Extract headers if available
  if (res.getHeaders) {
    metadata.headers = res.getHeaders();
  }

  return metadata;
}

/**
 * Extracts error metadata from an error object.
 */
export function extractErrorMetadata(error: unknown): ErrorMetadata {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      statusCode: (error as any).statusCode,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

/**
 * Gets a human-readable status message for an HTTP status code.
 */
function getStatusMessage(statusCode: number): string {
  const statusMessages: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };

  return statusMessages[statusCode] || "Unknown";
}

/**
 * Merges default options with user-provided options.
 */
export function mergeOptions(
  userOptions: Partial<VisionExpressOptions> = {},
): Required<VisionExpressOptions> {
  return {
    enabled: userOptions.enabled ?? true,
    excludeRoutes: userOptions.excludeRoutes ?? ["/health", "/metrics", "/status", "/favicon.ico"],
    correlationIdHeaders: userOptions.correlationIdHeaders ?? [
      "x-correlation-id",
      "x-request-id",
      "x-trace-id",
      "x-transaction-id",
      "correlation-id",
      "request-id",
    ],
    captureRequestMetadata: userOptions.captureRequestMetadata ?? true,
    captureResponseMetadata: userOptions.captureResponseMetadata ?? true,
    captureHeaders: userOptions.captureHeaders ?? true,
    captureBody: userOptions.captureBody ?? false,
    captureQuery: userOptions.captureQuery ?? true,
    captureQueryParams: userOptions.captureQueryParams ?? userOptions.captureQuery ?? true,
    captureParams: userOptions.captureParams ?? true,
    captureUserAgent: userOptions.captureUserAgent ?? true,
    captureIp: userOptions.captureIp ?? true,
    captureTiming: userOptions.captureTiming ?? true,
    contextNameGenerator:
      userOptions.contextNameGenerator ??
      ((req) => `${req.method.toLowerCase()}.${req.route?.path || req.path}`),
    shouldExcludeRoute:
      userOptions.shouldExcludeRoute ??
      ((req) => {
        const path = req.path.toLowerCase();
        return (
          path.includes("/health") ||
          path.includes("/metrics") ||
          path.includes("/status") ||
          path.includes("/ping") ||
          path.includes("/favicon.ico")
        );
      }),
    extractMetadata: userOptions.extractMetadata ?? (() => ({})),
    extractUser: userOptions.extractUser ?? (() => undefined),
    extractCorrelationId:
      userOptions.extractCorrelationId ??
      ((req) => {
        return (
          (req.headers["x-correlation-id"] as string) ||
          (req.headers["x-request-id"] as string) ||
          (req.headers["x-trace-id"] as string)
        );
      }),
    extractTenant: userOptions.extractTenant ?? (() => undefined),
    includeRequestIdInResponse: userOptions.includeRequestIdInResponse ?? true,
    includeRequestId:
      userOptions.includeRequestId ?? userOptions.includeRequestIdInResponse ?? true,
    requestIdHeader: userOptions.requestIdHeader ?? "X-Request-ID",
    captureErrors: userOptions.captureErrors ?? true,
    redactSensitiveData: userOptions.redactSensitiveData ?? true,
    redactedHeaders: userOptions.redactedHeaders ??
      userOptions.redactHeaders ?? [
        "authorization",
        "cookie",
        "x-api-key",
        "x-auth-token",
        "x-session-token",
      ],
    redactHeaders: userOptions.redactHeaders ??
      userOptions.redactedHeaders ?? [
        "authorization",
        "cookie",
        "x-api-key",
        "x-auth-token",
        "x-session-token",
      ],
    redactedQueryParams: userOptions.redactedQueryParams ??
      userOptions.redactQueryParams ?? ["token", "key", "secret", "password"],
    redactQueryParams: userOptions.redactQueryParams ??
      userOptions.redactedQueryParams ?? ["token", "key", "secret", "password"],
    redactedBodyFields: userOptions.redactedBodyFields ??
      userOptions.redactBodyFields ?? ["password", "token", "secret", "key", "ssn", "credit_card"],
    redactBodyFields: userOptions.redactBodyFields ??
      userOptions.redactedBodyFields ?? [
        "password",
        "token",
        "secret",
        "key",
        "ssn",
        "credit_card",
      ],
  };
}
