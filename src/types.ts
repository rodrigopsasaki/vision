import { z } from 'zod';
import type { VisionContext } from '@rodrigopsasaki/vision';

// Datadog API Configuration
export const DatadogConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  appKey: z.string().optional(),
  site: z.enum(['datadoghq.com', 'datadoghq.eu', 'us3.datadoghq.com', 'us5.datadoghq.com', 'ap1.datadoghq.com']).default('datadoghq.com'),
  service: z.string().min(1, 'Service name is required'),
  env: z.string().optional(),
  version: z.string().optional(),
  hostname: z.string().optional(),
  tags: z.array(z.string()).optional(),
  timeout: z.number().positive().default(10000),
  retries: z.number().int().min(0).max(5).default(3),
  batchSize: z.number().int().positive().default(100),
  flushInterval: z.number().positive().default(5000),
  // Vision-specific configuration
  exportMode: z.enum(['trace', 'metric', 'log', 'event']).default('trace'),
  includeContextData: z.boolean().default(true),
  includeTiming: z.boolean().default(true),
  includeErrorDetails: z.boolean().default(true),
  // Custom field mappings
  fieldMappings: z.object({
    contextName: z.string().default('vision.context.name'),
    contextScope: z.string().default('vision.context.scope'),
    contextSource: z.string().default('vision.context.source'),
    contextId: z.string().default('vision.context.id'),
    timestamp: z.string().default('vision.context.timestamp'),
  }).optional(),
});

export type DatadogConfig = z.infer<typeof DatadogConfigSchema>;

// Datadog Metric Types
export const MetricSchema = z.object({
  metric: z.string().min(1),
  points: z.array(z.tuple([z.number(), z.number()])).min(1),
  tags: z.array(z.string()).optional(),
  host: z.string().optional(),
  type: z.enum(['count', 'gauge', 'rate', 'histogram', 'distribution']).default('gauge'),
  interval: z.number().positive().optional(),
});

export type Metric = z.infer<typeof MetricSchema>;

// Datadog Log Types
export const LogSchema = z.object({
  message: z.string().min(1),
  timestamp: z.number().optional(),
  level: z.enum(['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug']).default('info'),
  service: z.string().optional(),
  hostname: z.string().optional(),
  ddsource: z.string().optional(),
  ddtags: z.string().optional(),
  host: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.unknown()).optional(),
});

export type Log = z.infer<typeof LogSchema>;

// Datadog Trace/Span Types
export const SpanSchema = z.object({
  trace_id: z.number(),
  span_id: z.number(),
  parent_id: z.number().optional(),
  name: z.string().min(1),
  resource: z.string().min(1),
  service: z.string().min(1),
  type: z.string().optional(),
  start: z.number(),
  duration: z.number().positive(),
  meta: z.record(z.string()).optional(),
  metrics: z.record(z.number()).optional(),
  error: z.number().optional(),
});

export type Span = z.infer<typeof SpanSchema>;

// Datadog Event Types
export const EventSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  date_happened: z.number().optional(),
  priority: z.enum(['normal', 'low']).default('normal'),
  host: z.string().optional(),
  tags: z.array(z.string()).optional(),
  alert_type: z.enum(['info', 'warning', 'error', 'success']).default('info'),
  aggregation_key: z.string().optional(),
  source_type_name: z.string().optional(),
});

export type Event = z.infer<typeof EventSchema>;

// Vision Context to Datadog Data Transformation
export interface VisionToDatadogTransformer {
  toMetric(context: VisionContext, error?: unknown): Metric;
  toLog(context: VisionContext, error?: unknown): Log;
  toSpan(context: VisionContext, error?: unknown): Span;
  toEvent(context: VisionContext, error?: unknown): Event;
}

// Batch Configuration
export interface BatchConfig {
  maxSize: number;
  maxWaitTime: number;
  retryAttempts: number;
  retryDelay: number;
}

// HTTP Client Configuration
export interface HttpClientConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
  headers: Record<string, string>;
}

// Error Types
export class DatadogExportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'DatadogExportError';
  }
}

export class DatadogValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'DatadogValidationError';
  }
}

// Response Types
export interface DatadogResponse {
  status: 'ok' | 'error';
  errors?: string[];
  status_code?: number;
}

// Queue Item Types
export interface QueueItem {
  id: string;
  type: 'metric' | 'log' | 'trace' | 'event';
  data: Metric | Log | Span | Event;
  timestamp: number;
  retryCount: number;
}

// Circuit Breaker States
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  expectedErrors: string[];
}

// Vision Datadog Exporter Interface
export interface VisionDatadogExporter {
  success(context: VisionContext): void;
  error(context: VisionContext, err: unknown): void;
  before?(context: VisionContext): void;
  after?(context: VisionContext): void;
  onError?(context: VisionContext, err: unknown): void;
  flush(): Promise<void>;
  close(): Promise<void>;
} 