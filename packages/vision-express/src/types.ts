import type { Request, Response, NextFunction } from "express";
import type { VisionContext } from "@rodrigopsasaki/vision";

/**
 * Configuration options for the Vision Express middleware.
 */
export interface VisionExpressOptions {
  /**
   * Whether to automatically capture request metadata.
   * Defaults to true.
   */
  captureRequestMetadata?: boolean;

  /**
   * Whether to automatically capture response metadata.
   * Defaults to true.
   */
  captureResponseMetadata?: boolean;

  /**
   * Whether to capture request headers.
   * Defaults to true.
   */
  captureHeaders?: boolean;

  /**
   * Whether to capture request body (for non-GET requests).
   * Defaults to false for security reasons.
   */
  captureBody?: boolean;

  /**
   * Whether to capture query parameters.
   * Defaults to true.
   */
  captureQuery?: boolean;

  /**
   * Whether to capture URL parameters.
   * Defaults to true.
   */
  captureParams?: boolean;

  /**
   * Whether to capture user agent information.
   * Defaults to true.
   */
  captureUserAgent?: boolean;

  /**
   * Whether to capture IP address information.
   * Defaults to true.
   */
  captureIp?: boolean;

  /**
   * Whether to capture timing information.
   * Defaults to true.
   */
  captureTiming?: boolean;

  /**
   * Custom function to generate context names.
   * Defaults to using the HTTP method and route path.
   */
  contextNameGenerator?: (req: Request) => string;

  /**
   * Custom function to determine if a route should be excluded from Vision tracking.
   * Defaults to excluding health check and metrics endpoints.
   */
  shouldExcludeRoute?: (req: Request) => boolean;

  /**
   * Custom function to extract additional metadata from the request.
   * This data will be merged into the initial context data.
   */
  extractMetadata?: (req: Request) => Record<string, unknown>;

  /**
   * Custom function to extract user information from the request.
   * This will be stored under the 'user' key in the context.
   */
  extractUser?: (req: Request) => unknown;

  /**
   * Custom function to extract correlation IDs from the request.
   * This will be stored under the 'correlation_id' key in the context.
   */
  extractCorrelationId?: (req: Request) => string | undefined;

  /**
   * Custom function to extract tenant/organization information.
   * This will be stored under the 'tenant' key in the context.
   */
  extractTenant?: (req: Request) => string | undefined;

  /**
   * Whether to include the request ID in the response headers.
   * Defaults to true.
   */
  includeRequestIdInResponse?: boolean;

  /**
   * The header name to use for the request ID in responses.
   * Defaults to 'X-Request-ID'.
   */
  requestIdHeader?: string;

  /**
   * Whether to capture error details when an error occurs.
   * Defaults to true.
   */
  captureErrors?: boolean;

  /**
   * Whether to redact sensitive information from captured data.
   * Defaults to true.
   */
  redactSensitiveData?: boolean;

  /**
   * List of header names to redact (e.g., ['authorization', 'cookie']).
   * Defaults to common sensitive headers.
   */
  redactedHeaders?: string[];

  /**
   * List of query parameter names to redact.
   * Defaults to common sensitive query params.
   */
  redactedQueryParams?: string[];

  /**
   * List of body field names to redact.
   * Defaults to common sensitive body fields.
   */
  redactedBodyFields?: string[];
}

/**
 * Extended Express Request interface with Vision context.
 */
export interface VisionRequest extends Request {
  /**
   * The active Vision context for this request.
   */
  visionContext?: VisionContext;
}

/**
 * Extended Express Response interface with Vision context.
 */
export interface VisionResponse extends Response {
  /**
   * The active Vision context for this response.
   */
  visionContext?: VisionContext;
  
  /**
   * Override end method to capture response metadata.
   */
  end(chunk?: any, encoding?: any, cb?: any): Response;
  
  /**
   * Set response header.
   */
  set(field: string, value?: string | string[]): Response;
}

/**
 * Express middleware function type with Vision integration.
 */
export type VisionExpressMiddleware = (
  req: VisionRequest,
  res: VisionResponse,
  next: NextFunction,
) => void | Promise<void>;

/**
 * Default configuration for the Vision Express middleware.
 */
export const DEFAULT_VISION_EXPRESS_OPTIONS: Required<VisionExpressOptions> = {
  captureRequestMetadata: true,
  captureResponseMetadata: true,
  captureHeaders: true,
  captureBody: false,
  captureQuery: true,
  captureParams: true,
  captureUserAgent: true,
  captureIp: true,
  captureTiming: true,
  contextNameGenerator: (req) => `${req.method.toLowerCase()}.${req.route?.path || req.path}`,
  shouldExcludeRoute: (req) => {
    const path = req.path.toLowerCase();
    return (
      path.includes("/health") ||
      path.includes("/metrics") ||
      path.includes("/status") ||
      path.includes("/ping") ||
      path.includes("/favicon.ico")
    );
  },
  extractMetadata: () => ({}),
  extractUser: () => undefined,
  extractCorrelationId: (req) => {
    return (
      req.headers["x-correlation-id"] as string ||
      req.headers["x-request-id"] as string ||
      req.headers["x-trace-id"] as string
    );
  },
  extractTenant: () => undefined,
  includeRequestIdInResponse: true,
  requestIdHeader: "X-Request-ID",
  captureErrors: true,
  redactSensitiveData: true,
  redactedHeaders: [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
    "x-session-token",
  ],
  redactedQueryParams: ["token", "key", "secret", "password"],
  redactedBodyFields: ["password", "token", "secret", "key", "ssn", "credit_card"],
};

/**
 * Request metadata that can be captured automatically.
 */
export interface RequestMetadata {
  method: string;
  url: string;
  path: string;
  protocol: string;
  hostname?: string;
  ip?: string;
  userAgent?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  body?: unknown;
  correlationId?: string;
  user?: unknown;
  tenant?: string;
}

/**
 * Response metadata that can be captured automatically.
 */
export interface ResponseMetadata {
  statusCode: number;
  statusMessage: string;
  headers?: Record<string, string>;
  timing?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

/**
 * Error metadata that can be captured when errors occur.
 */
export interface ErrorMetadata {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
} 