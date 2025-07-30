// Main exports
export {
  VisionDatadogExporter,
  createDatadogExporter,
  createSimpleDatadogExporter,
} from "./vision-datadog-exporter.js";

// Type exports
export type {
  DatadogConfig,
  Metric,
  Log,
  Span,
  Event,
  VisionDatadogExporter as IVisionDatadogExporter,
  VisionToDatadogTransformer,
  BatchConfig,
  HttpClientConfig,
  DatadogResponse,
  QueueItem,
  CircuitBreakerState,
  CircuitBreakerConfig,
} from "./types.js";

// Schema exports
export { DatadogConfigSchema, MetricSchema, LogSchema, SpanSchema, EventSchema } from "./types.js";

// Error exports
export { DatadogExportError, DatadogValidationError } from "./types.js";

// Utility exports
export { DatadogHttpClient } from "./http-client.js";
export { BatchProcessor } from "./batch-processor.js";
export { VisionDatadogTransformer } from "./transformer.js";
