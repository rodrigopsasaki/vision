import type { VisionContext } from "./types"
import { visionStore } from "./global"

export function getContextStore() {
  return visionStore
}

export function getContext(): VisionContext {
  const ctx = visionStore.getStore()
  if (!ctx) {
    throw new Error("No active vision context")
  }
  return ctx
}

export function visionSet<K extends string, V = unknown>(key: K, value: V): void {
  getContext().data.set(key, value)
}

export function visionGet<T = unknown>(key: string): T | undefined {
  return getContext().data.get(key)
}
