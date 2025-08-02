/**
 * Represents a serializable error structure that captures error information
 */
export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
  code?: string | number;
  cause?: unknown;
  [key: string]: unknown;
}

/**
 * Safely serializes any error-like value into a plain object.
 *
 * JavaScript's error handling is fundamentally broken - you can throw anything,
 * errors have non-enumerable properties, and they often serialize to {}.
 * This function ensures errors are always captured meaningfully.
 *
 * @param error - Any thrown value (Error, string, number, object, etc.)
 * @returns A plain object with error information
 */
export function serializeError(error: unknown): SerializedError {
  // Handle null/undefined early
  if (error === null || error === undefined) {
    return {
      message: `${error}`,
      name: "NullError",
      originalValue: error,
    };
  }

  // Handle Error instances (including subclasses)
  if (error instanceof Error) {
    // Start with a plain object to avoid prototype issues
    const serialized: SerializedError = {
      message: error.message || "Unknown error",
      name: error.name || "Error",
    };

    // Copy stack trace if available
    if (error.stack) {
      serialized.stack = error.stack;
    }

    // Handle common error properties
    const descriptors = Object.getOwnPropertyDescriptors(error);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      // Skip what we've already handled
      if (key === "message" || key === "name" || key === "stack") continue;

      // Only copy if it's safe to access
      if (descriptor.enumerable || descriptor.value !== undefined) {
        try {
          const value: unknown = descriptor.value ?? error[key as keyof Error];
          // Avoid circular references by not copying objects deeply
          if (value !== error && value !== undefined) {
            serialized[key] = value;
          }
        } catch {
          // Ignore getter errors
        }
      }
    }

    // Special handling for cause (might be circular)
    if ("cause" in error && error.cause !== error) {
      try {
        serialized.cause = error.cause instanceof Error ? serializeError(error.cause) : error.cause;
      } catch {
        serialized.cause = "[Circular or inaccessible cause]";
      }
    }

    // Preserve error type information
    serialized.errorType = error.constructor.name;

    return serialized;
  }

  // Handle string errors (common pattern)
  if (typeof error === "string") {
    return {
      message: error,
      name: "StringError",
      originalValue: error,
    };
  }

  // Handle objects that might be error-like
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;

    // Start with common error-like properties
    const serialized: SerializedError = {
      message: String(
        obj.message ||
          obj.error ||
          obj.reason ||
          obj.description ||
          obj.detail ||
          obj.details ||
          "[Object error]",
      ),
      name: String(obj.name || obj.type || obj.code || "ObjectError"),
    };

    // Try to safely copy properties
    try {
      // Get own properties to avoid prototype pollution
      const keys = Object.getOwnPropertyNames(obj);
      for (const key of keys) {
        if (key === "message" || key === "name") continue;

        try {
          const value = obj[key];
          // Basic circular reference check
          if (value !== obj && value !== undefined) {
            // Preserve the value as-is for simple types and shallow objects
            serialized[key] = value;
          }
        } catch {
          // Property access might throw
        }
      }
    } catch {
      // Even Object.getOwnPropertyNames can throw on some objects
      serialized.serializationError = true;
    }

    // Try to get a meaningful representation if we still have nothing
    if (serialized.message === "[Object error]") {
      try {
        serialized.message = JSON.stringify(obj);
      } catch {
        try {
          serialized.message = String(obj);
        } catch {
          serialized.message = "[Unserializable error]";
        }
      }
    }

    return serialized;
  }

  // Handle primitives (numbers, booleans, symbols, functions)
  return {
    message: String(error),
    name: `${typeof error}Error`,
    originalValue: typeof error === "symbol" || typeof error === "function" ? String(error) : error,
  };
}

/**
 * Type guard to check if a value might be an error-like object.
 * Used to determine if automatic error serialization should be applied.
 */
export function isErrorLike(value: unknown): boolean {
  // Obvious error types
  if (value instanceof Error) return true;

  // Check for error-like objects
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    // Common error property patterns
    const hasErrorProps =
      typeof obj.message === "string" ||
      typeof obj.error === "string" ||
      typeof obj.stack === "string" ||
      typeof obj.code === "string" ||
      typeof obj.errno === "number" ||
      "cause" in obj;

    // Common error type indicators
    const hasErrorType =
      (typeof obj.name === "string" && obj.name.includes("Error")) ||
      (typeof obj.type === "string" && obj.type.includes("error"));

    // Constructor name check
    const hasErrorConstructor = obj.constructor?.name?.includes("Error") || false;

    return hasErrorProps || hasErrorType || hasErrorConstructor;
  }

  return false;
}

/**
 * Creates a standardized error entry for Vision contexts.
 * This is what gets stored when errors are captured.
 */
export function createErrorEntry(
  error: unknown,
  metadata?: {
    fatal?: boolean;
    handled?: boolean;
    operation?: string;
    [key: string]: unknown;
  },
): Record<string, unknown> {
  const serialized = serializeError(error);

  const entry: Record<string, unknown> = {
    error: serialized,
    timestamp: new Date().toISOString(),
    errorClass: "captured",
  };

  // Add metadata if provided
  if (metadata) {
    const { fatal, handled, operation, ...rest } = metadata;

    if (fatal !== undefined) entry.fatal = fatal;
    if (handled !== undefined) entry.handled = handled;
    if (operation) entry.operation = operation;

    // Include any additional metadata
    if (Object.keys(rest).length > 0) {
      entry.metadata = rest;
    }
  }

  return entry;
}
