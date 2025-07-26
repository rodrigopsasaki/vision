import { createExporter, registerExporter, unregisterExporter } from "../exporters/exports";
import { fanOutToExporters } from "../exporters/fanOut";
import { generateId } from "../utils/generateId";

import { visionSet, visionGet, visionPush, visionMerge, getContext } from "./context";
import { getContextStore, getRuntimeState, initVisionRuntime } from "./global";
import type { VisionContext, VisionInitOptions } from "./types";

/**
 * Creates a new vision context and executes the provided callback within it.
 *
 * This is the primary function for structured observability in Vision. It creates
 * a scoped context that captures all data set during execution and automatically
 * exports it to all registered exporters upon completion.
 *
 * @param options - Either a string (context name) or a full options object
 * @param callback - The async function to execute within the vision context
 * @returns The result of the callback function
 *
 * @example
 * ```typescript
 * // Simple usage with just a name
 * await observe("user.login", async () => {
 *   vision.set("user_id", "user123");
 *   // ... work happens ...
 * });
 *
 * // Advanced usage with full options
 * await observe({
 *   name: "order.processing",
 *   scope: "http",
 *   source: "api-gateway",
 *   initial: { request_id: "req-123" }
 * }, async () => {
 *   vision.set("order_id", "order456");
 *   // ... work happens ...
 * });
 * ```
 */
export async function observe<T>(
  options: string | VisionInitOptions,
  callback: () => Promise<T>,
): Promise<T> {
  const opts: VisionInitOptions = typeof options === "string" ? { name: options } : options;

  const context: VisionContext = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    name: opts.name,
    scope: opts.scope,
    source: opts.source,
    data: new Map(Object.entries(opts.initial ?? {})),
  };

  const store = getContextStore();

  return store.run(context, async () => {
    const exporters = getRuntimeState().exporters.map(createExporter);

    // Execute exporter before hooks
    for (const exporter of exporters) {
      if (exporter.before) {
        try {
          exporter.before(context);
        } catch (beforeError) {
          console.error(`[vision] Before hook error in exporter '${exporter.name}':`, beforeError);
        }
      }
    }

    try {
      const result = await callback();

      // Execute exporter after hooks (success)
      for (const exporter of exporters) {
        if (exporter.after) {
          try {
            exporter.after(context);
          } catch (afterError) {
            console.error(`[vision] After hook error in exporter '${exporter.name}':`, afterError);
          }
        }
      }

      fanOutToExporters(exporters, context);
      return result;
    } catch (err) {
      // Execute exporter onError hooks
      for (const exporter of exporters) {
        if (exporter.onError) {
          try {
            exporter.onError(context, err);
          } catch (onErrorError) {
            console.error(
              `[vision] OnError hook error in exporter '${exporter.name}':`,
              onErrorError,
            );
          }
        }
      }

      fanOutToExporters(exporters, context, err);
      throw err;
    }
  });
}

/**
 * The main Vision API object that provides structured observability capabilities.
 *
 * Vision replaces traditional logging with structured context capture. Instead of
 * scattered log statements, you create scoped contexts that automatically collect
 * and export all relevant data.
 *
 * @example
 * ```typescript
 * import { vision } from "@rodrigopsasaki/vision";
 *
 * // Basic usage
 * await vision.observe("my.workflow", async () => {
 *   vision.set("user_id", "user123");
 *   vision.set("status", "processing");
 *   // ... work happens ...
 * });
 *
 * // Advanced usage with custom exporters
 * vision.init({
 *   exporters: [myCustomExporter]
 * });
 * ```
 */
export const vision = {
  /**
   * Starts a new context and captures structured data throughout its lifecycle.
   *
   * This is the primary method for creating structured observability contexts.
   * All data set during execution is automatically captured and exported.
   *
   * @param options - Context configuration (name string or full options object)
   * @param callback - Async function to execute within the context
   * @returns Promise that resolves to the callback result
   */
  observe,

  /**
   * Initializes the vision runtime with custom configuration.
   *
   * Call this method to customize the default behavior, such as adding
   * custom exporters or overriding the default console exporter.
   *
   * @param options - Runtime configuration options
   *
   * @example
   * ```typescript
   * vision.init({
   *   exporters: [
   *     {
   *       name: "datadog",
   *       success: (ctx) => sendToDatadog(ctx),
   *       error: (ctx, err) => sendErrorToDatadog(ctx, err)
   *     }
   *   ]
   * });
   * ```
   */
  init: initVisionRuntime,

  /**
   * Registers a new exporter to receive vision context data.
   *
   * Exporters are called automatically when contexts complete (success or error).
   * They can forward data to external systems like logging services, metrics
   * platforms, or observability tools.
   *
   * @param exporter - The exporter to register
   *
   * @example
   * ```typescript
   * vision.registerExporter({
   *   name: "my-exporter",
   *   success: (ctx) => console.log("Success:", ctx),
   *   error: (ctx, err) => console.error("Error:", ctx, err)
   * });
   * ```
   */
  registerExporter,

  /**
   * Unregisters an exporter by name.
   *
   * @param name - The name of the exporter to remove
   *
   * @example
   * ```typescript
   * vision.unregisterExporter("my-exporter");
   * ```
   */
  unregisterExporter,

  // Context manipulation primitives
  /**
   * Sets a key-value pair in the current vision context.
   *
   * @param key - The key to set
   * @param value - The value to store
   *
   * @example
   * ```typescript
   * vision.set("user_id", "user123");
   * vision.set("request_count", 42);
   * ```
   */
  set: visionSet,

  /**
   * Retrieves a value from the current vision context.
   *
   * @param key - The key to retrieve
   * @returns The stored value or undefined if not found
   *
   * @example
   * ```typescript
   * const userId = vision.get("user_id");
   * const count = vision.get("request_count");
   * ```
   */
  get: visionGet,

  /**
   * Pushes a value to an array in the current vision context.
   *
   * If the key doesn't exist, an empty array is created first.
   *
   * @param key - The key for the array
   * @param value - The value to push
   *
   * @example
   * ```typescript
   * vision.push("events", "user_logged_in");
   * vision.push("events", "order_created");
   * // Results in: ["user_logged_in", "order_created"]
   * ```
   */
  push: visionPush,

  /**
   * Merges an object into an existing object in the current vision context.
   *
   * If the key doesn't exist, an empty object is created first.
   *
   * @param key - The key for the object
   * @param value - The object to merge
   *
   * @example
   * ```typescript
   * vision.merge("metadata", { version: "1.0.0" });
   * vision.merge("metadata", { region: "us-east-1" });
   * // Results in: { version: "1.0.0", region: "us-east-1" }
   * ```
   */
  merge: visionMerge,

  /**
   * Gets the current active vision context.
   *
   * @returns The current vision context
   * @throws Error if called outside of a vision context
   *
   * @example
   * ```typescript
   * const ctx = vision.context();
   * console.log("Context ID:", ctx.id);
   * console.log("Context name:", ctx.name);
   * ```
   */
  context: getContext,
};
