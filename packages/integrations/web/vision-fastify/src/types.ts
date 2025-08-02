import type { VisionContext } from "@rodrigopsasaki/vision";
import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";

/**
 * Configuration options for the Vision Fastify plugin.
 */
export interface VisionFastifyOptions {
  /**
   * Whether the plugin is enabled.
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
   * Whether to capture Fastify-specific metadata.
   * Defaults to true.
   */
  captureFastifyMetadata?: boolean;

  /**
   * Custom function to generate context names.
   */
  contextNameGenerator?: (request: FastifyRequest) => string;

  /**
   * Function to determine if a route should be excluded.
   */
  shouldExcludeRoute?: (request: FastifyRequest) => boolean;

  /**
   * Custom function to extract additional metadata.
   */
  extractMetadata?: (request: FastifyRequest) => Record<string, unknown>;

  /**
   * Custom function to extract user information from the request.
   */
  extractUser?: (request: FastifyRequest) => unknown;

  /**
   * Custom function to extract correlation ID from the request.
   */
  extractCorrelationId?: (request: FastifyRequest) => string | undefined;

  /**
   * Custom function to extract tenant information.
   */
  extractTenant?: (request: FastifyRequest) => unknown;

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
    transformError?: (error: Error, request: FastifyRequest) => Record<string, unknown>;
  };
}

/**
 * Extended Fastify Request interface with Vision context.
 */
export interface VisionFastifyRequest extends FastifyRequest {
  /**
   * The active Vision context for this request.
   */
  visionContext?: VisionContext;
}

/**
 * Extended Fastify Reply interface with Vision context.
 */
export interface VisionFastifyReply extends FastifyReply {
  /**
   * The active Vision context for this reply.
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
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  user?: unknown;
  tenant?: unknown;
  fastify?: {
    routeId?: string;
    routeOptions?: Record<string, unknown>;
    validation?: Record<string, unknown>;
  };
}

/**
 * Response metadata that can be captured automatically.
 */
export interface ResponseMetadata extends Record<string, unknown> {
  statusCode: number;
  statusMessage?: string;
  headers?: Record<string, string>;
  duration: number;
  timing?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  fastify?: {
    serialization?: {
      duration?: number;
    };
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
  statusCode?: number;
  validation?: unknown;
  fastify?: {
    kind?: string;
    statusCode?: number;
  };
}

/**
 * Default configuration for the Vision Fastify plugin.
 */
export const DEFAULT_VISION_FASTIFY_OPTIONS: Required<VisionFastifyOptions> = {
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

  contextNameGenerator: (request) =>
    `${request.method.toLowerCase()}.${request.routeOptions?.url || request.url}`,

  shouldExcludeRoute: (request) => {
    const url = request.url.toLowerCase();
    return (
      url.includes("/health") ||
      url.includes("/metrics") ||
      url.includes("/status") ||
      url.includes("/ping") ||
      url.includes("/favicon.ico")
    );
  },

  extractMetadata: () => ({}),

  extractUser: (request) => {
    // Try to extract user from common authentication patterns
    return (
      (request as any).user ||
      (request as any).session?.user ||
      request.headers["x-user-id"] ||
      request.headers["x-user"] ||
      undefined
    );
  },

  extractCorrelationId: (request) => {
    return (
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string) ||
      (request.headers["x-trace-id"] as string) ||
      (request.headers["x-transaction-id"] as string)
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
    "x-csrf-token",
  ],
  redactQueryParams: ["token", "key", "secret", "password", "auth", "api_key"],
  redactBodyFields: [
    "password",
    "ssn",
    "credit_card",
    "creditCard",
    "secret",
    "api_key",
    "apiKey",
    "private_key",
    "privateKey",
  ],

  correlationIdHeaders: [
    "x-correlation-id",
    "x-request-id",
    "x-trace-id",
    "x-transaction-id",
    "correlation-id",
    "request-id",
  ],

  performance: {
    trackExecutionTime: true,
    slowOperationThreshold: 1000,
    trackMemoryUsage: false,
  },

  errorHandling: {
    captureErrors: true,
    captureStackTrace: process.env.NODE_ENV !== "production",
    transformError: (error, request) => ({
      name: error.name,
      message: error.message,
      ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
      statusCode: (error as any).statusCode,
      code: (error as any).code,
      validation: (error as any).validation,
    }),
  },
};

/**
 * Plugin registration options.
 */
export interface VisionFastifyPluginOptions extends VisionFastifyOptions {
  /**
   * Plugin name for Fastify registration.
   * Defaults to 'vision'.
   */
  name?: string;
}
