/**
 * Represents a single scoped vision context.
 * Each vision context is uniquely identified and holds structured metadata.
 */
export interface VisionContext {
  /** Unique identifier for this context */
  id: string;

  /** ISO 8601 timestamp marking when the context was initialized */
  timestamp: string;

  /** Descriptive name of the context (e.g. 'flag-evaluation') */
  name: string;

  /** Optional category or type (e.g. 'http', 'cli', 'job') */
  scope?: string;

  /** Optional string indicating the source of the context (e.g. service name) */
  source?: string;

  /** Structured key-value data collected during context execution */
  data: Map<string, unknown>;
}

/**
 * Configuration object passed to `vision.with()`.
 * Used to initialize a vision context with optional metadata and identity.
 */
export interface VisionInitOptions {
  /** Descriptive name of the context */
  name: string;

  /** Optional category or type for grouping */
  scope?: string;

  /** Optional identifier for the source of the context */
  source?: string;

  /** Optional key-value data to initialize the context with */
  initial?: Record<string, unknown>;
}

/**
 * Exporters are side-effect consumers of vision contexts.
 * All registered exporters will be called on both success and error flows.
 */
export interface VisionExporter {
  /**
   * A human-readable name for this exporter (used for debugging).
   */
  name: string;

  /**
   * Called when a context completes successfully.
   */
  success: (ctx: VisionContext) => void;

  /**
   * Called when a context throws or rejects.
   */
  error?: (ctx: VisionContext, err: unknown) => void;
}

/**
 * Interface for custom loggers that observe vision context lifecycles.
 *
 * A logger can optionally handle both successful events and errors,
 * and will be invoked automatically when using `vision.observe`.
 */
export interface VisionLogger {
  /**
   * Called when a vision context completes successfully.
   *
   * This is the canonical place to log metadata, emit structured events,
   * or trigger observability hooks.
   *
   * @param ctx - The finalized context for this unit of work.
   */
  event: (ctx: VisionContext) => void;

  /**
   * (Optional) Called when the observed function throws or rejects.
   *
   * This hook allows you to capture both the context and the error object,
   * and is useful for error tracking or redaction-aware exporters.
   *
   * @param ctx - The context active at the time of error.
   * @param err - The thrown or rejected error.
   */
  error?: (ctx: VisionContext, err: unknown) => void;
}

/**
 * Represents the internal runtime configuration for the vision system.
 * This state is initialized via `vision.init()` and governs the behavior
 * of context logging and data exporting throughout the application.
 */
export interface VisionRuntimeState {
  /**
   * A list of exporters to be invoked on every completed context.
   * Exporters receive the full context and can forward it to any external system.
   */
  exporters: ReadonlyArray<VisionExporter>;
}
