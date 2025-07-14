/**
 * Represents a single scoped vision context.
 * Each vision context is uniquely identified and holds structured metadata.
 */
export interface VisionContext {
  /** Unique identifier for this context */
  id: string

  /** ISO 8601 timestamp marking when the context was initialized */
  timestamp: string

  /** Descriptive name of the context (e.g. 'flag-evaluation') */
  name: string

  /** Optional category or type (e.g. 'http', 'cli', 'job') */
  scope?: string

  /** Optional string indicating the source of the context (e.g. service name) */
  source?: string

  /** Structured key-value data collected during context execution */
  data: Map<string, unknown>
}

/**
 * Configuration object passed to `vision.with()`.
 * Used to initialize a vision context with optional metadata and identity.
 */
export interface VisionInitOptions {
  /** Descriptive name of the context */
  name: string

  /** Optional category or type for grouping */
  scope?: string

  /** Optional identifier for the source of the context */
  source?: string

  /** Optional key-value data to initialize the context with */
  initial?: Record<string, unknown>
}
