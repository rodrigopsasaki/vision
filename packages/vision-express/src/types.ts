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
   * Custom function to extract user information from the request.
   * Uses smart defaults to detect common authentication patterns.
   */
  extractUser?: (req: Request) => unknown;

  /**
   * Headers to check for correlation IDs.
   * Defaults to common correlation ID headers.
   */
  correlationIdHeaders?: string[];

  /**
   * Whether to capture request headers.
   * Defaults to true.
   */
  captureHeaders?: boolean;

  /**
   * Whether to capture query parameters.
   * Defaults to true.
   */
  captureQueryParams?: boolean;

  /**
   * Whether to capture request body.
   * Defaults to false for security reasons.
   */
  captureBody?: boolean;

  /**
   * Headers to redact (sensitive data).
   * Defaults to common sensitive headers.
   */
  redactHeaders?: string[];

  /**
   * Query parameters to redact (sensitive data).
   * Defaults to common sensitive query params.
   */
  redactQueryParams?: string[];

  /**
   * Body fields to redact (sensitive data).
   * Defaults to common sensitive body fields.
   */
  redactBodyFields?: string[];

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
  
  // Smart user extraction - tries common patterns
  extractUser: (req) => {
    // Try to extract user from common authentication patterns
    return (req as any).user || 
           (req as any).session?.user ||
           req.headers["x-user-id"] ||
           req.headers["x-user"] ||
           undefined;
  },
  
  // Smart correlation ID extraction - tries common headers
  correlationIdHeaders: [
    "x-correlation-id",
    "x-request-id", 
    "x-trace-id",
    "x-transaction-id",
    "correlation-id",
    "request-id"
  ],
  
  // Sensible defaults for metadata capture
  captureHeaders: true,
  captureQueryParams: true,
  captureBody: false, // Off by default for security
  
  // Sensible defaults for security
  redactHeaders: [
    "authorization",
    "cookie", 
    "x-api-key",
    "x-auth-token",
    "x-session-token",
    "x-csrf-token"
  ],
  redactQueryParams: [
    "token",
    "key", 
    "secret",
    "password",
    "auth",
    "api_key"
  ],
  redactBodyFields: [
    "password",
    "ssn",
    "credit_card",
    "secret",
    "api_key",
    "private_key"
  ],
  
  // Response options
  includeRequestId: true,
  requestIdHeader: "X-Request-ID",
};

/**
 * Request metadata that can be captured automatically.
 */
export interface RequestMetadata {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
}

/**
 * Response metadata that can be captured automatically.
 */
export interface ResponseMetadata {
  statusCode: number;
  headers?: Record<string, string>;
  duration: number;
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