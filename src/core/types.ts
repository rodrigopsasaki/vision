export interface VisionContext {
  id: string
  timestamp: string
  name: string
  scope?: string
  source?: string
  data: Map<string, any>
}
