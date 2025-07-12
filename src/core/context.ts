import { AsyncLocalStorage } from "async_hooks"

import { VisionContext } from "./types"

const storage = new AsyncLocalStorage<VisionContext>()

export function getContextStore() {
  return storage
}

export function getContext(): VisionContext {
  const ctx = storage.getStore()
  if (!ctx) throw new Error("No active vision context")
  return ctx
}

export function add(key: string, value: any) {
  getContext().data.set(key, value)
}

export function get(key: string): any {
  return getContext().data.get(key)
}
