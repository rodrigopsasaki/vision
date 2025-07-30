import type { VisionContext } from "@rodrigopsasaki/vision";
import type { ExecutionContext } from "@nestjs/common";

/**
 * Extended Request interface with Vision context attached.
 */
export interface VisionRequest {
  visionContext?: VisionContext;
  path?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string | string[]>;
  query?: Record<string, any>;
  body?: any;
  params?: Record<string, string>;
  ip?: string;
  user?: any;
}

/**
 * Extended Response interface with Vision context attached.
 */
export interface VisionResponse {
  visionContext?: VisionContext;
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
  getHeaders?: () => Record<string, any>;
}

/**
 * Supported NestJS execution contexts for Vision integration.
 */
export type VisionExecutionContextType = "http" | "rpc" | "ws" | "graphql";

/**
 * Configuration options for the Vision NestJS integration.
 */
export interface VisionNestJSOptions {
  /**
   * Whether the interceptor is enabled globally.
   * @default true
   */
  enabled?: boolean;

  /**
   * Routes or patterns to exclude from Vision tracking.
   * Supports glob patterns and regular expressions.
   * @default ["/health", "/metrics", "/favicon.ico"]
   */
  excludeRoutes?: (string | RegExp)[];

  /**
   * Custom function to extract user information from the request.
   * Works across HTTP, GraphQL, WebSocket, and microservice contexts.
   */
  extractUser?: (context: ExecutionContext) => unknown;

  /**
   * Headers to check for correlation/trace IDs.
   * @default ["x-correlation-id", "x-trace-id", "x-request-id", "correlation-id", "trace-id"]
   */
  correlationIdHeaders?: string[];

  /**
   * Whether to capture HTTP request/response metadata.
   * @default true
   */
  captureRequest?: boolean;

  /**
   * Whether to capture HTTP headers.
   * @default false
   */
  captureHeaders?: boolean;

  /**
   * Whether to capture query parameters.
   * @default true
   */
  captureQueryParams?: boolean;

  /**
   * Whether to capture request body.
   * @default false
   */
  captureBody?: boolean;

  /**
   * Whether to capture method execution metadata (parameters, return values).
   * @default false
   */
  captureMethodExecution?: boolean;

  /**
   * Whether to capture method parameters.
   * Requires captureMethodExecution to be true.
   * @default false
   */
  captureMethodParams?: boolean;

  /**
   * Whether to capture method return values.
   * Requires captureMethodExecution to be true.
   * @default false
   */
  captureMethodReturns?: boolean;

  /**
   * Whether to capture GraphQL operation details.
   * Only applies to GraphQL contexts.
   * @default true
   */
  captureGraphQLOperation?: boolean;

  /**
   * Whether to capture WebSocket event details.
   * Only applies to WebSocket contexts.
   * @default true
   */
  captureWebSocketEvents?: boolean;

  /**
   * Whether to capture microservice message details.
   * Only applies to RPC contexts.
   * @default true
   */
  captureMicroserviceMessages?: boolean;

  /**
   * Headers to redact from captured data.
   * @default ["authorization", "cookie", "x-api-key", "x-auth-token"]
   */
  redactHeaders?: string[];

  /**
   * Query parameters to redact from captured data.
   * @default ["password", "token", "api_key", "access_token"]
   */
  redactQueryParams?: string[];

  /**
   * Body fields to redact from captured data.
   * @default ["password", "token", "secret", "api_key", "access_token"]
   */
  redactBodyFields?: string[];

  /**
   * Whether to include the request ID in response headers.
   * @default false
   */
  includeRequestId?: boolean;

  /**
   * Header name for the request ID.
   * @default "x-vision-request-id"
   */
  requestIdHeader?: string;

  /**
   * Custom context name generator function.
   * If not provided, uses smart defaults based on execution context.
   */
  generateContextName?: (context: ExecutionContext) => string;

  /**
   * Custom error transformer function.
   * Allows customization of how errors are captured and structured.
   */
  transformError?: (error: unknown, context: ExecutionContext) => Record<string, unknown>;

  /**
   * Performance tracking options.
   */
  performance?: {
    /**
     * Whether to track method execution time.
     * @default true
     */
    trackExecutionTime?: boolean;

    /**
     * Whether to track memory usage.
     * @default false
     */
    trackMemoryUsage?: boolean;

    /**
     * Threshold in milliseconds for slow operation warnings.
     * @default 1000
     */
    slowOperationThreshold?: number;
  };
}

/**
 * Default configuration for Vision NestJS integration.
 */
export const DEFAULT_VISION_NESTJS_OPTIONS: Required<VisionNestJSOptions> = {
  enabled: true,
  excludeRoutes: ["/health", "/metrics", "/favicon.ico"],
  extractUser: () => undefined,
  correlationIdHeaders: ["x-correlation-id", "x-trace-id", "x-request-id", "correlation-id", "trace-id"],
  captureRequest: true,
  captureHeaders: false,
  captureQueryParams: true,
  captureBody: false,
  captureMethodExecution: false,
  captureMethodParams: false,
  captureMethodReturns: false,
  captureGraphQLOperation: true,
  captureWebSocketEvents: true,
  captureMicroserviceMessages: true,
  redactHeaders: ["authorization", "cookie", "x-api-key", "x-auth-token"],
  redactQueryParams: ["password", "token", "api_key", "access_token"],
  redactBodyFields: ["password", "token", "secret", "api_key", "access_token"],
  includeRequestId: false,
  requestIdHeader: "x-vision-request-id",
  generateContextName: (context: ExecutionContext) => {
    const contextType = context.getType<VisionExecutionContextType>();
    const controller = context.getClass();
    const handler = context.getHandler();
    
    return `${contextType}.${controller.name}.${handler.name}`;
  },
  transformError: (error: unknown) => ({
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }),
  performance: {
    trackExecutionTime: true,
    trackMemoryUsage: false,
    slowOperationThreshold: 1000,
  },
};

/**
 * Token for injecting Vision NestJS options.
 */
export const VISION_NESTJS_OPTIONS = Symbol("VISION_NESTJS_OPTIONS");

/**
 * Token for injecting the Vision service.
 */
export const VISION_SERVICE = Symbol("VISION_SERVICE");

/**
 * Metadata key for Vision context configuration at the method level.
 */
export const VISION_CONTEXT_METADATA = "vision:context";

/**
 * Metadata key for Vision ignore configuration.
 */
export const VISION_IGNORE_METADATA = "vision:ignore";

/**
 * Metadata key for Vision capture configuration.
 */
export const VISION_CAPTURE_METADATA = "vision:capture";

/**
 * Method-level Vision context configuration.
 */
export interface VisionContextConfig {
  /**
   * Custom context name for this method.
   */
  name?: string;

  /**
   * Custom scope for this method.
   */
  scope?: string;

  /**
   * Custom source for this method.
   */
  source?: string;

  /**
   * Initial data to set in the context.
   */
  initial?: Record<string, unknown>;

  /**
   * Whether to capture method parameters for this specific method.
   */
  captureParams?: boolean;

  /**
   * Whether to capture return value for this specific method.
   */
  captureReturn?: boolean;

  /**
   * Whether to track performance for this specific method.
   */
  trackPerformance?: boolean;
}

/**
 * Configuration for Vision capture behavior at the method level.
 */
export interface VisionCaptureConfig {
  /**
   * Whether to capture request data for this method.
   */
  request?: boolean;

  /**
   * Whether to capture headers for this method.
   */
  headers?: boolean;

  /**
   * Whether to capture body for this method.
   */
  body?: boolean;

  /**
   * Whether to capture query parameters for this method.
   */
  query?: boolean;

  /**
   * Whether to capture method parameters for this method.
   */
  params?: boolean;

  /**
   * Whether to capture return value for this method.
   */
  returns?: boolean;

  /**
   * Custom fields to capture from the request.
   */
  customFields?: string[];
}