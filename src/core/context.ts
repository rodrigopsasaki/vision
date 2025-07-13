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
  return getContext().data.get(key) as T | undefined
}

export function visionPush<T = unknown>(key: string, value: T): void {
  const ctx = getContext()
  const current = ctx.data.get(key)

  if (Array.isArray(current)) {
    current.push(value)
  } else {
    ctx.data.set(key, [value])
  }
}

export function visionMerge<T extends Record<string, unknown>>(key: string, value: T): void {
  const ctx = getContext()
  const current = ctx.data.get(key)

  if (typeof current === "object" && current !== null && !Array.isArray(current)) {
    ctx.data.set(key, { ...current, ...value })
  } else {
    ctx.data.set(key, value)
  }
}
