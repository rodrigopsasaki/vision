import type { VisionContext } from "@rodrigopsasaki/vision";
import type { Context, Next, Middleware } from "koa";

/**
 * Configuration options for the Vision Koa middleware.
 */
export interface VisionKoaOptions {
  /**
   * Whether the middleware is enabled.
   * Defaults to true.
   */
  enabled?: boolean;

  /**
   * Routes to exclude from Vision tracking using glob patterns.
   * Defaults to health checks and metrics endpoints.
   */
  excludeRoutes?: string[];

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
   * Whether to capture Koa-specific metadata.
   * Defaults to true.
   */
  captureKoaMetadata?: boolean;

  /**
   * Custom function to generate context names.
   */
  contextNameGenerator?: (ctx: Context) => string;

  /**
   * Function to determine if a route should be excluded.
   */
  shouldExcludeRoute?: (ctx: Context) => boolean;

  /**
   * Custom function to extract additional metadata.
   */
  extractMetadata?: (ctx: Context) => Record<string, unknown>;

  /**
   * Custom function to extract user information from the context.
   */
  extractUser?: (ctx: Context) => unknown;

  /**
   * Custom function to extract correlation ID from the context.
   */
  extractCorrelationId?: (ctx: Context) => string | undefined;

  /**
   * Custom function to extract tenant information.
   */
  extractTenant?: (ctx: Context) => unknown;

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
  redactHeaders?: string[];

  /**
   * Query parameters to redact (sensitive data).
   */
  redactQueryParams?: string[];

  /**
   * Body fields to redact (sensitive data).
   */
  redactBodyFields?: string[];

  /**
   * Headers to check for correlation IDs.
   * Defaults to common correlation ID headers.
   */
  correlationIdHeaders?: string[];

  /**
   * Performance tracking options.
   */
  performance?: {
    /**
     * Whether to track execution time.
     * Defaults to true.
     */
    trackExecutionTime?: boolean;

    /**
     * Threshold in milliseconds to consider an operation slow.
     * Defaults to 1000ms.
     */
    slowOperationThreshold?: number;

    /**
     * Whether to track memory usage.
     * Defaults to false for performance.
     */
    trackMemoryUsage?: boolean;
  };

  /**
   * Error handling options.
   */
  errorHandling?: {
    /**
     * Whether to capture error details.
     * Defaults to true.
     */
    captureErrors?: boolean;

    /**
     * Whether to capture error stack traces.
     * Defaults to true in development, false in production.
     */
    captureStackTrace?: boolean;

    /**
     * Custom error transformer function.
     */
    transformError?: (error: Error, ctx: Context) => Record<string, unknown>;
  };
}

/**
 * Extended Koa Context interface with Vision context.
 */
export interface VisionKoaContext extends Context {
  /**
   * The active Vision context for this request.
   */
  visionContext?: VisionContext;
}

/**
 * Request metadata that can be captured automatically.
 */
export interface RequestMetadata extends Record<string, unknown> {
  method: string;
  url: string;
  path?: string;
  originalUrl?: string;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  user?: unknown;
  tenant?: unknown;
  koa?: {
    state?: Record<string, unknown>;
    cookies?: Record<string, string>;
    secure?: boolean;
    fresh?: boolean;
    stale?: boolean;
  };
}

/**
 * Response metadata that can be captured automatically.
 */
export interface ResponseMetadata extends Record<string, unknown> {
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  length?: number;
  duration: number;
  timing?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  koa?: {
    respond?: boolean;
    writable?: boolean;
  };
}

/**
 * Error metadata that can be captured when errors occur.
 */
export interface ErrorMetadata extends Record<string, unknown> {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  status?: number;
  expose?: boolean;
  koa?: {
    status?: number;
    expose?: boolean;
  };
}

/**
 * Default configuration for the Vision Koa middleware.
 */
export const DEFAULT_VISION_KOA_OPTIONS: Required<VisionKoaOptions> = {
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

  contextNameGenerator: (ctx) => 
    `${ctx.method.toLowerCase()}.${ctx.path}`,

  shouldExcludeRoute: (ctx) => {
    const path = ctx.path.toLowerCase();
    return (
      path.includes("/health") ||
      path.includes("/metrics") ||
      path.includes("/status") ||
      path.includes("/ping") ||
      path.includes("/favicon.ico")
    );
  },

  extractMetadata: () => ({}),

  extractUser: (ctx) => {
    // Try to extract user from common authentication patterns
    return (ctx as any).user || 
           (ctx as any).state?.user ||
           ctx.headers["x-user-id"] ||
           ctx.headers["x-user"] ||
           undefined;
  },

  extractCorrelationId: (ctx) => {
    return (
      ctx.headers["x-correlation-id"] as string ||
      ctx.headers["x-request-id"] as string ||
      ctx.headers["x-trace-id"] as string ||
      ctx.headers["x-transaction-id"] as string
    );
  },

  extractTenant: () => undefined,

  includeRequestId: true,
  requestIdHeader: "X-Request-ID",

  redactSensitiveData: true,
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
    "creditCard",
    "secret",
    "api_key",
    "apiKey",
    "private_key",
    "privateKey"
  ],

  correlationIdHeaders: [
    "x-correlation-id",
    "x-request-id",
    "x-trace-id",
    "x-transaction-id",
    "correlation-id",
    "request-id"
  ],

  performance: {
    trackExecutionTime: true,
    slowOperationThreshold: 1000,
    trackMemoryUsage: false,
  },

  errorHandling: {
    captureErrors: true,
    captureStackTrace: process.env.NODE_ENV !== "production",
    transformError: (error, ctx) => ({
      name: error.name,
      message: error.message,
      ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
      status: (error as any).status,
      code: (error as any).code,
      expose: (error as any).expose,
    }),
  },
};

/**
 * Vision Koa middleware function type.
 */
export type VisionKoaMiddleware = Middleware;