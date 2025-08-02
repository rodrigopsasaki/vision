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

/**
 * Default normalization configuration.
 */
const DEFAULT_NORMALIZATION_CONFIG = {
  enabled: false,
  keyCasing: "none" as const,
  deep: true,
};

/**
 * Initializes the vision runtime with optional custom configuration.
 *
 * This function sets up the global vision runtime state, including the default
 * exporters and normalization settings. If no options are provided, it uses
 * the default console exporter and disabled normalization.
 *
 * @param options - Optional runtime configuration
 *
 * @example
 * ```typescript
 * // Initialize with default console exporter
 * initVisionRuntime();
 *
 * // Initialize with custom exporters
 * initVisionRuntime({
 *   exporters: [
 *     {
 *       name: "custom",
 *       success: (ctx) => console.log("Success:", ctx),
 *       error: (ctx, err) => console.error("Error:", ctx, err)
 *     }
 *   ]
 * });
 *
 * // Initialize with key normalization
 * initVisionRuntime({
 *   normalization: {
 *     enabled: true,
 *     keyCasing: "snake_case",
 *     deep: true
 *   }
 * });
 * ```
 */
export function initVisionRuntime(options?: Partial<VisionRuntimeState>) {
  globalThis.__vision__.runtimeState = {
    exporters: (options?.exporters ?? [defaultConsoleExporter]).map(createExporter),
    normalization: {
      ...DEFAULT_NORMALIZATION_CONFIG,
      ...options?.normalization,
    },
  };
}

/**
 * Gets the current vision runtime state, initializing it if needed.
 *
 * This function ensures the vision runtime is properly initialized and returns
 * the current state. If no runtime state exists, it automatically initializes
 * with default settings.
 *
 * @returns The current vision runtime state
 *
 * @example
 * ```typescript
 * const runtime = getRuntimeState();
 * console.log("Active exporters:", runtime.exporters.length);
 * ```
 */
export function getRuntimeState(): VisionRuntimeState {
  if (!globalThis.__vision__.runtimeState) {
    initVisionRuntime();
  }

  return globalThis.__vision__.runtimeState!;
}

/**
 * Returns the global vision AsyncLocalStorage instance, initializing it if needed.
 *
 * This function manages the global AsyncLocalStorage that maintains vision
 * context across async operations. It ensures thread-safe context isolation
 * for concurrent operations.
 *
 * @returns The AsyncLocalStorage instance for vision contexts
 *
 * @example
 * ```typescript
 * const store = getContextStore();
 * const context = store.getStore();
 * if (context) {
 *   console.log("Current context:", context.name);
 * }
 * ```
 */
export function getContextStore(): AsyncLocalStorage<VisionContext> {
  if (!globalThis.__vision__.contextStore) {
    globalThis.__vision__.contextStore = new AsyncLocalStorage<VisionContext>();
  }
  return globalThis.__vision__.contextStore;
}
