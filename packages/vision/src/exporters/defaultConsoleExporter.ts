import type { VisionExporter } from "../core/types";

/**
 * The default console exporter that logs vision contexts to stdout/stderr.
 * 
 * This exporter provides basic console logging for vision contexts. It logs
 * successful contexts to stdout and failed contexts to stderr with error details.
 * This exporter is automatically included when no custom exporters are provided.
 * 
 * @example
 * ```typescript
 * // This exporter is used by default
 * await vision.observe("my.workflow", async () => {
 *   vision.set("user_id", "user123");
 *   // Console output: [vision] success { id: "...", name: "my.workflow", ... }
 * });
 * ```
 */
export const defaultConsoleExporter: VisionExporter = {
  name: "console",
  success: (ctx) => {
    const { id, name, scope, source, timestamp, data } = ctx;
    console.log("[vision] success", {
      id,
      name,
      scope,
      source,
      timestamp,
      data: Object.fromEntries(data.entries()),
    });
  },
  error: (ctx, err) => {
    const { id, name, scope, source, timestamp, data } = ctx;
    console.error("[vision] error", {
      id,
      name,
      scope,
      source,
      timestamp,
      data: Object.fromEntries(data.entries()),
      error: formatError(err),
    });
  },
};

/**
 * Formats an error object for consistent console output.
 * 
 * This function ensures that errors are formatted consistently regardless of
 * their type. It handles Error objects, plain objects, and primitive values.
 * 
 * @param err - The error to format
 * @returns A formatted error object suitable for logging
 * 
 * @example
 * ```typescript
 * formatError(new Error("Something went wrong"));
 * // Returns: { name: "Error", message: "Something went wrong", stack: "..." }
 * 
 * formatError("Simple string error");
 * // Returns: { error: "Simple string error" }
 * ```
 */
function formatError(err: unknown): unknown {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }

  return typeof err === "object" && err !== null ? err : { error: String(err) };
}
