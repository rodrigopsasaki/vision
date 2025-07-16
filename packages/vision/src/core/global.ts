import { AsyncLocalStorage } from "node:async_hooks";

import { defaultConsoleExporter } from "../exporters/defaultConsoleExporter";
import { createExporter } from "../exporters/exports";

import type { VisionContext, VisionRuntimeState } from "./types";

interface VisionGlobal {
  contextStore?: AsyncLocalStorage<VisionContext>;
  runtimeState?: VisionRuntimeState;
}
declare global {
  // biome-ignore lint/style/noVar: used for global scoping
  var __vision__: VisionGlobal;
}

// Initialize the global object if needed
globalThis.__vision__ ??= {};

export function initVisionRuntime(options?: Partial<VisionRuntimeState>) {
  globalThis.__vision__.runtimeState = {
    exporters: (options?.exporters ?? [defaultConsoleExporter]).map(createExporter),
  };
}

export function getRuntimeState(): VisionRuntimeState {
  if (!globalThis.__vision__.runtimeState) {
    initVisionRuntime();
  }

  return globalThis.__vision__.runtimeState!;
}

/**
 * Returns the global vision AsyncLocalStorage instance, initializing it if needed.
 */
export function getContextStore(): AsyncLocalStorage<VisionContext> {
  if (!globalThis.__vision__.contextStore) {
    globalThis.__vision__.contextStore = new AsyncLocalStorage<VisionContext>();
  }
  return globalThis.__vision__.contextStore;
}
