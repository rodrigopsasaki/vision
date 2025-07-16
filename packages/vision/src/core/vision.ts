import { createExporter, registerExporter, unregisterExporter } from "../exporters/exports";
import { fanOutToExporters } from "../exporters/fanOut";
import { generateId } from "../utils/generateId";

import { visionSet, visionGet, visionPush, visionMerge, getContext } from "./context";
import { getContextStore, getRuntimeState, initVisionRuntime } from "./global";
import type { VisionContext, VisionInitOptions } from "./types";

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

    try {
      const result = await callback();
      fanOutToExporters(exporters, context);
      return result;
    } catch (err) {
      fanOutToExporters(exporters, context, err);
      throw err;
    }
  });
}

export const vision = {
  /**
   * Starts a new context and captures structured data throughout its lifecycle.
   */
  observe,

  /**
   * Initializes the vision runtime.
   * You can override the default exporter or add additional ones here.
   */
  init: initVisionRuntime,

  /**
   * Registers a new exporter. Exporters are called automatically on success and error.
   */
  registerExporter,

  /**
   * Unregisters a previously added exporter by name.
   */
  unregisterExporter,

  // Context manipulation primitives
  set: visionSet,
  get: visionGet,
  push: visionPush,
  merge: visionMerge,
  context: getContext,
};
