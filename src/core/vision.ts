import { v4 as uuidv4 } from 'uuid'
import { getContextStore } from './context'
import { VisionContext } from './types'

export async function vision<T>(
  nameOrOpts: string | {
    name: string
    scope?: string
    source?: string
    initial?: Record<string, any>
  },
  fn: () => Promise<T>
): Promise<T> {
  const opts = typeof nameOrOpts === 'string'
    ? { name: nameOrOpts }
    : nameOrOpts

  const context: VisionContext = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    name: opts.name,
    scope: opts.scope,
    source: opts.source,
    data: new Map(Object.entries(opts.initial || {})),
  }

  const store = getContextStore()
  return store.run(context, fn)
}
