import { getRuntimeState } from "../core/global";
import type { VisionExporter } from "../core/types";

/**
 * Wraps a VisionExporter and guarantees that `error` falls back to `success` if undefined.
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
 */
export function registerExporter(exporter: VisionExporter): void {
  const runtime = getRuntimeState();
  runtime.exporters = [...runtime.exporters, createExporter(exporter)];
}

/**
 * Removes an exporter by name from the active runtime.
 */
export function unregisterExporter(name: string): void {
  const runtime = getRuntimeState();
  runtime.exporters = runtime.exporters.filter((exporter) => exporter.name !== name);
}
