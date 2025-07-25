import { getRuntimeState } from "../core/global";
import type { VisionExporter } from "../core/types";

/**
 * Wraps a VisionExporter and guarantees that all optional methods have default implementations.
 * 
 * This function normalizes exporters by providing default implementations for optional
 * lifecycle hooks. It ensures that all exporters have consistent behavior regardless
 * of which optional methods they implement.
 * 
 * @param exporter - The exporter to normalize
 * @returns A normalized exporter with all optional methods implemented
 * 
 * @example
 * ```typescript
 * const myExporter: VisionExporter = {
 *   name: "my-exporter",
 *   success: (ctx) => console.log("Success:", ctx)
 *   // Note: error, before, after, onError are optional
 * };
 * 
 * const normalized = createExporter(myExporter);
 * // Now normalized has default implementations for all optional methods
 * ```
 */
export function createExporter(exporter: VisionExporter): Required<VisionExporter> {
  return {
    name: exporter.name,
    success: exporter.success,
    error: exporter.error ?? ((ctx) => exporter.success(ctx)),
    before: exporter.before ?? (() => {}),
    after: exporter.after ?? (() => {}),
    onError: exporter.onError ?? (() => {}),
  };
}

/**
 * Registers a new exporter, ensuring it's normalized and available for fanout.
 * 
 * This function adds a new exporter to the global runtime state. The exporter
 * will be called automatically when vision contexts complete (success or error).
 * 
 * @param exporter - The exporter to register
 * 
 * @example
 * ```typescript
 * registerExporter({
 *   name: "datadog",
 *   success: (ctx) => sendToDatadog(ctx),
 *   error: (ctx, err) => sendErrorToDatadog(ctx, err),
 *   before: (ctx) => startDatadogSpan(ctx),
 *   after: (ctx) => finishDatadogSpan(ctx)
 * });
 * ```
 */
export function registerExporter(exporter: VisionExporter): void {
  const runtime = getRuntimeState();
  runtime.exporters = [...runtime.exporters, createExporter(exporter)];
}

/**
 * Removes an exporter by name from the active runtime.
 * 
 * This function removes an exporter from the global runtime state. The exporter
 * will no longer receive vision context data.
 * 
 * @param name - The name of the exporter to remove
 * 
 * @example
 * ```typescript
 * // Remove a specific exporter
 * unregisterExporter("datadog");
 * 
 * // Remove the default console exporter
 * unregisterExporter("console");
 * ```
 */
export function unregisterExporter(name: string): void {
  const runtime = getRuntimeState();
  runtime.exporters = runtime.exporters.filter((exporter) => exporter.name !== name);
}
