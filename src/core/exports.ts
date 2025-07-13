import type { VisionContext } from "./types"
import { getContext } from "./context"

const exporters = new Map<string, (ctx: VisionContext) => void>()

export function registerExporter(name: string, fn: (ctx: VisionContext) => void) {
  exporters.set(name, fn)
}

export function exportTo(name: string) {
  const ctx = getContext()
  const fn = exporters.get(name)
  if (!fn) {
    throw new Error(`Exporter '${name}' not found`)
  }
  fn(ctx)
}
