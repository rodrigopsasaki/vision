import type { ExecutionContext } from "@nestjs/common";

import type { VisionRequest } from "./types";

/**
 * Checks if a route should be excluded from Vision tracking.
 */
export function isRouteExcluded(path: string, excludePatterns: (string | RegExp)[]): boolean {
  if (!path) return false;

  const normalizedPath = path.toLowerCase();

  return excludePatterns.some((pattern) => {
    if (typeof pattern === "string") {
      return normalizedPath.includes(pattern.toLowerCase());
    }

    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }

    return false;
  });
}

/**
 * Extracts HTTP request information for Vision context.
 */
export function extractHttpInfo(
  request: VisionRequest,
  options: {
    captureHeaders?: boolean;
    captureQuery?: boolean;
    captureBody?: boolean;
    redactHeaders?: string[];
    redactQuery?: string[];
    redactBody?: string[];
  },
) {
  const info: Record<string, unknown> = {
    method: request.method,
    path: request.path || request.url,
    ip: request.ip || request.connection?.remoteAddress,
    user_agent: request.headers?.["user-agent"],
  };

  // Capture headers if enabled
  if (options.captureHeaders && request.headers) {
    const headers: Record<string, unknown> = {};

    Object.entries(request.headers).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase();

      if (options.redactHeaders?.includes(normalizedKey)) {
        headers[key] = "[REDACTED]";
      } else {
        headers[key] = Array.isArray(value) ? value.join(", ") : value;
      }
    });

    info.headers = headers;
  }

  // Capture query parameters if enabled
  if (options.captureQuery && request.query) {
    const query: Record<string, unknown> = {};

    Object.entries(request.query).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase();

      if (options.redactQuery?.includes(normalizedKey)) {
        query[key] = "[REDACTED]";
      } else {
        query[key] = value;
      }
    });

    info.query = query;
  }

  // Capture body if enabled
  if (options.captureBody && request.body) {
    info.body = redactSensitiveData(request.body, options.redactBody || []);
  }

  return info;
}

/**
 * Extracts GraphQL operation information for Vision context.
 */
export function extractGraphQLInfo(context: ExecutionContext) {
  try {
    // Try to get GraphQL context using different approaches
    const gqlContext = context.getArgs()[2]; // GraphQL context is typically the 3rd argument
    const info = context.getArgs()[3]; // GraphQL info is typically the 4th argument

    const graphqlInfo: Record<string, unknown> = {};

    // Extract operation info
    if (info) {
      graphqlInfo.operation_name = info.operation?.name?.value;
      graphqlInfo.operation_type = info.operation?.operation;
      graphqlInfo.field_name = info.fieldName;
      graphqlInfo.parent_type = info.parentType?.name;
      graphqlInfo.return_type = info.returnType?.toString();
    }

    // Extract variables from context
    if (gqlContext?.req?.body?.variables) {
      graphqlInfo.variables = redactSensitiveData(gqlContext.req.body.variables, [
        "password",
        "token",
        "secret",
        "api_key",
      ]);
    }

    // Extract query string (be careful with size)
    if (gqlContext?.req?.body?.query) {
      const query = gqlContext.req.body.query;
      graphqlInfo.query = query.length > 1000 ? `${query.substring(0, 1000)}...` : query;
    }

    return graphqlInfo;
  } catch (error) {
    return {
      extraction_error: "Failed to extract GraphQL info",
      error_message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extracts WebSocket event information for Vision context.
 */
export function extractWebSocketInfo(context: ExecutionContext) {
  try {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    const wsInfo: Record<string, unknown> = {
      event: context.getHandler().name,
    };

    // Extract client information if available
    if (client) {
      wsInfo.client_id = client.id;
      wsInfo.client_rooms = client.rooms ? Array.from(client.rooms) : undefined;

      // Extract connection info
      if (client.handshake) {
        wsInfo.handshake = {
          headers: redactSensitiveData(client.handshake.headers, ["authorization", "cookie"]),
          query: client.handshake.query,
          address: client.handshake.address,
        };
      }
    }

    // Extract event data (be careful with sensitive information)
    if (data && typeof data === "object") {
      wsInfo.event_data = redactSensitiveData(data, ["password", "token", "secret"]);
    }

    return wsInfo;
  } catch (error) {
    return {
      extraction_error: "Failed to extract WebSocket info",
      error_message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extracts microservice message information for Vision context.
 */
export function extractMicroserviceInfo(context: ExecutionContext) {
  try {
    const rpcContext = context.switchToRpc();
    const data = rpcContext.getData();
    const contextData = rpcContext.getContext();

    const microserviceInfo: Record<string, unknown> = {
      handler: context.getHandler().name,
      pattern: contextData?.pattern || contextData?.cmd,
    };

    // Extract message data
    if (data) {
      microserviceInfo.message_data = redactSensitiveData(data, ["password", "token", "secret"]);
    }

    // Extract context metadata
    if (contextData) {
      const contextMeta: Record<string, unknown> = {};

      // Common microservice context properties
      if (contextData.pattern) contextMeta.pattern = contextData.pattern;
      if (contextData.cmd) contextMeta.command = contextData.cmd;
      if (contextData.id) contextMeta.message_id = contextData.id;
      if (contextData.timestamp) contextMeta.timestamp = contextData.timestamp;

      microserviceInfo.context = contextMeta;
    }

    return microserviceInfo;
  } catch (error) {
    return {
      extraction_error: "Failed to extract microservice info",
      error_message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Recursively redacts sensitive data from an object.
 */
export function redactSensitiveData(data: any, sensitiveFields: string[]): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, sensitiveFields));
  }

  const redacted: Record<string, unknown> = {};
  const normalizedSensitiveFields = sensitiveFields.map((field) => field.toLowerCase());

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase();

    if (normalizedSensitiveFields.includes(normalizedKey)) {
      redacted[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      redacted[key] = redactSensitiveData(value, sensitiveFields);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Safely extracts method parameters for Vision capture.
 */
export function extractMethodParameters(context: ExecutionContext): Record<string, unknown> {
  try {
    const args = context.getArgs();
    const parameters: Record<string, unknown> = {};

    // Different contexts have different argument patterns
    const contextType = context.getType() as "http" | "rpc" | "ws" | "graphql";

    switch (contextType) {
      case "http":
        // HTTP: [request, response, next]
        if (args[0]?.params) parameters.params = args[0].params;
        if (args[0]?.query) parameters.query = args[0].query;
        if (args[0]?.body)
          parameters.body = redactSensitiveData(args[0].body, ["password", "token"]);
        break;

      case "rpc":
        // RPC: [data, context]
        if (args[0]) parameters.data = redactSensitiveData(args[0], ["password", "token"]);
        break;

      case "ws":
        // WebSocket: [client, data]
        if (args[1]) parameters.data = redactSensitiveData(args[1], ["password", "token"]);
        break;

      case "graphql":
        // GraphQL: [parent, args, context, info]
        if (args[1]) parameters.args = redactSensitiveData(args[1], ["password", "token"]);
        break;

      default:
        // Fallback: capture all non-function arguments
        args.forEach((arg, index) => {
          if (typeof arg !== "function") {
            parameters[`arg_${index}`] = redactSensitiveData(arg, ["password", "token"]);
          }
        });
    }

    return parameters;
  } catch (error) {
    return {
      extraction_error: "Failed to extract method parameters",
      error_message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generates a smart context name based on the execution context.
 */
export function generateSmartContextName(context: ExecutionContext): string {
  const contextType = context.getType() as "http" | "rpc" | "ws" | "graphql";
  const controllerName = context.getClass().name;
  const handlerName = context.getHandler().name;

  // Remove common suffixes for cleaner names
  const cleanControllerName = controllerName.replace(/Controller$/, "").toLowerCase();
  const cleanHandlerName = handlerName.replace(/Handler$/, "").toLowerCase();

  switch (contextType) {
    case "http":
      try {
        const request = context.switchToHttp().getRequest();
        const method = request.method?.toLowerCase() || "unknown";
        return `http.${method}.${cleanControllerName}.${cleanHandlerName}`;
      } catch {
        return `http.${cleanControllerName}.${cleanHandlerName}`;
      }

    case "graphql":
      return `graphql.${cleanControllerName}.${cleanHandlerName}`;

    case "ws":
      return `ws.${cleanControllerName}.${cleanHandlerName}`;

    case "rpc":
      return `rpc.${cleanControllerName}.${cleanHandlerName}`;

    default:
      return `${contextType}.${cleanControllerName}.${cleanHandlerName}`;
  }
}

/**
 * Checks if the current execution is in a test environment.
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;
}

/**
 * Safely converts a value to a string for logging purposes.
 */
export function safeStringify(value: unknown, maxLength = 1000): string {
  try {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string")
      return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);

    const stringified = JSON.stringify(value, null, 2);
    return stringified.length > maxLength
      ? `${stringified.substring(0, maxLength)}...`
      : stringified;
  } catch {
    return "[Unable to stringify]";
  }
}
