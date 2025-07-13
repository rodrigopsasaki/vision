export interface VisionContext {
  id: string
  timestamp: string
  name: string
  scope?: string
  source?: string
  data: Map<string, any>
}

export interface VisionInitOptions {
  name: string
  scope?: string
  source?: string
  initial?: Record<string, unknown>
}
