import type { VisionContext } from "@rodrigopsasaki/vision";
import type { Request, Response, NextFunction } from "express";

/**
 * Configuration options for the Vision Express middleware.
 */
export interface VisionExpressOptions {
  /**
   * Whether the middleware is enabled.
   * Defaults to true.
   */
  enabled?: boolean;

  /**
   * Routes to exclude from Vision tracking.
   * Defaults to health checks and metrics endpoints.
   */
  excludeRoutes?: string[];

  /**
   * Headers to check for correlation IDs.
   * Defaults to common correlation ID headers.
   */
  correlationIdHeaders?: string[];

  /**
   * Whether to capture request metadata.
   * Defaults to true.
   */
  captureRequestMetadata?: boolean;

  /**
   * Whether to capture response metadata.
   * Defaults to true.
   */
  captureResponseMetadata?: boolean;

  /**
   * Whether to capture request headers.
   * Defaults to true.
   */
  captureHeaders?: boolean;

  /**
   * Whether to capture request body.
   * Defaults to false for security reasons.
   */
  captureBody?: boolean;

  /**
   * Whether to capture query parameters.
   * Defaults to true.
   */
  captureQuery?: boolean;

  /**
   * Whether to capture query parameters (alias for captureQuery).
   * Defaults to true.
   */
  captureQueryParams?: boolean;

  /**
   * Whether to capture route parameters.
   * Defaults to true.
   */
  captureParams?: boolean;

  /**
   * Whether to capture user agent.
   * Defaults to true.
   */
  captureUserAgent?: boolean;

  /**
   * Whether to capture client IP address.
   * Defaults to true.
   */
  captureIp?: boolean;

  /**
   * Whether to capture timing information.
   * Defaults to true.
   */
  captureTiming?: boolean;

  /**
   * Whether to capture errors.
   * Defaults to true.
   */
  captureErrors?: boolean;

  /**
   * Custom function to generate context names.
   */
  contextNameGenerator?: (req: Request) => string;

  /**
   * Function to determine if a route should be excluded.
   */
  shouldExcludeRoute?: (req: Request) => boolean;

  /**
   * Custom function to extract additional metadata.
   */
  extractMetadata?: (req: Request) => Record<string, unknown>;

  /**
   * Custom function to extract user information from the request.
   */
  extractUser?: (req: Request) => unknown;

  /**
   * Custom function to extract correlation ID from the request.
   */
  extractCorrelationId?: (req: Request) => string | undefined;

  /**
   * Custom function to extract tenant information.
   */
  extractTenant?: (req: Request) => unknown;

  /**
   * Whether to include the request ID in the response headers.
   * Defaults to true.
   */
  includeRequestIdInResponse?: boolean;

  /**
   * Whether to include the request ID in the response headers.
   * Defaults to true.
   */
  includeRequestId?: boolean;

  /**
   * The header name to use for the request ID in responses.
   * Defaults to 'X-Request-ID'.
   */
  requestIdHeader?: string;

  /**
   * Whether to redact sensitive data.
   * Defaults to true.
   */
  redactSensitiveData?: boolean;

  /**
   * Headers to redact (sensitive data).
   */
  redactedHeaders?: string[];

  /**
   * Headers to redact (alias for redactedHeaders).
   */
  redactHeaders?: string[];

  /**
   * Query parameters to redact (sensitive data).
   */
  redactedQueryParams?: string[];

  /**
   * Query parameters to redact (alias for redactedQueryParams).
   */
  redactQueryParams?: string[];

  /**
   * Body fields to redact (sensitive data).
   */
  redactedBodyFields?: string[];

  /**
   * Body fields to redact (alias for redactedBodyFields).
   */
  redactBodyFields?: string[];
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
export interface VisionResponse extends Omit<Response, 'end' | 'set'> {
  /**
   * The active Vision context for this response.
   */
  visionContext?: VisionContext;
  
  /**
   * Override end method to capture response metadata.
   */
  end(chunk?: any, encoding?: any, cb?: any): VisionResponse;
  
  /**
   * Set response header.
   */
  set(field: string, value?: string | string[]): VisionResponse;
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
  enabled: true,
  excludeRoutes: ["/health", "/metrics", "/status", "/favicon.ico"],
  correlationIdHeaders: [
    "x-correlation-id",
    "x-request-id", 
    "x-trace-id",
    "x-transaction-id",
    "correlation-id",
    "request-id"
  ],
  captureRequestMetadata: true,
  captureResponseMetadata: true,
  captureHeaders: true,
  captureBody: false,
  captureQuery: true,
  captureQueryParams: true,
  captureParams: true,
  captureUserAgent: true,
  captureIp: true,
  captureTiming: true,
  captureErrors: true,
  
  contextNameGenerator: (req) => 
    `${req.method.toLowerCase()}.${req.route?.path || req.path}`,
  
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
  
  extractUser: (req) => {
    return (req as any).user || 
           (req as any).session?.user ||
           req.headers["x-user-id"] ||
           req.headers["x-user"] ||
           undefined;
  },
  
  extractCorrelationId: (req) => {
    return (
      req.headers["x-correlation-id"] as string ||
      req.headers["x-request-id"] as string ||
      req.headers["x-trace-id"] as string
    );
  },
  
  extractTenant: () => undefined,
  
  includeRequestIdInResponse: true,
  includeRequestId: true,
  requestIdHeader: "X-Request-ID",
  
  redactSensitiveData: true,
  redactedHeaders: [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
    "x-session-token",
    "x-csrf-token"
  ],
  redactHeaders: [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
    "x-session-token",
    "x-csrf-token"
  ],
  redactedQueryParams: [
    "token",
    "key",
    "secret",
    "password",
    "auth",
    "api_key"
  ],
  redactQueryParams: [
    "token",
    "key",
    "secret",
    "password",
    "auth",
    "api_key"
  ],
  redactedBodyFields: [
    "password",
    "ssn",
    "credit_card",
    "secret",
    "api_key",
    "private_key"
  ],
  redactBodyFields: [
    "password",
    "ssn",
    "credit_card",
    "secret",
    "api_key",
    "private_key"
  ],
};

/**
 * Request metadata that can be captured automatically.
 */
export interface RequestMetadata {
  method: string;
  path: string;
  url?: string;
  protocol?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  body?: unknown;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  user?: unknown;
  tenant?: unknown;
}

/**
 * Response metadata that can be captured automatically.
 */
export interface ResponseMetadata {
  statusCode: number;
  statusMessage?: string;
  headers?: Record<string, string>;
  duration: number;
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