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
            console.error(`[vision] OnError hook error in exporter '${exporter.name}':`, onErrorError);
          }
        }
      }
      
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
