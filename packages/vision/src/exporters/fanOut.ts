import type { VisionContext, VisionExporter } from "../core/types";

/**
 * Calls all exporters with either success or error paths.
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
