import { AsyncLocalStorage } from "async_hooks"
import type { VisionContext } from "./types"

declare global {
  var __visionContextStore: AsyncLocalStorage<VisionContext> | undefined
}

if (!globalThis.__visionContextStore) {
  globalThis.__visionContextStore = new AsyncLocalStorage<VisionContext>()
}

export const visionStore = globalThis.__visionContextStore!
