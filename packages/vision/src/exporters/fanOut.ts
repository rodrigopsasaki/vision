import type { VisionContext, VisionExporter } from "../core/types";

/**
 * Calls all exporters with either success or error paths.
 *
 * This function is responsible for distributing vision context data to all
 * registered exporters. It handles both successful completion and error cases,
 * ensuring that all exporters receive the appropriate callbacks.
 *
 * @param exporters - Array of normalized exporters to call
 * @param context - The vision context to distribute
 * @param error - Optional error that occurred during execution
 *
 * @example
 * ```typescript
 * // Success case
 * fanOutToExporters(exporters, context);
 *
 * // Error case
 * try {
 *   await someAsyncWork();
 * } catch (error) {
 *   fanOutToExporters(exporters, context, error);
 *   throw error;
 * }
 * ```
 */
export function fanOutToExporters(
  exporters: readonly Required<VisionExporter>[],
  context: VisionContext,
  error?: unknown,
): void {
  for (const exporter of exporters) {
    if (error) {
      exporter.error(context, error);
    } else {
      exporter.success(context);
    }
  }
}
