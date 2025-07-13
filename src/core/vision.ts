import { generateId } from "../utils/generateId"

import { getContextStore } from "./context"
import { visionSet, visionGet, visionPush, visionMerge, getContext } from "./context"
import { exportTo, registerExporter } from "./exports"
import type { VisionContext, VisionInitOptions } from "./types"

export async function visionWith<T>(
  opts: string | VisionInitOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const normalized: VisionInitOptions = typeof opts === "string" ? { name: opts } : opts

  const context: VisionContext = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    name: normalized.name,
    scope: normalized.scope,
    source: normalized.source,
    data: new Map(Object.entries(normalized.initial || {})),
  }

  const store = getContextStore()
  return store.run(context, fn)
}

export const vision = {
  with: visionWith,
  set: visionSet,
  get: visionGet,
  push: visionPush,
  merge: visionMerge,
  context: getContext,
  exportTo,
  registerExporter,
}
