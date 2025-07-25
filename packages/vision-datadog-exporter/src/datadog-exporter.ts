import { z } from 'zod';
import { 
  DatadogConfig, 
  DatadogConfigSchema, 
  Metric, 
  Log, 
  Span, 
  Event, 
  DatadogExporter as IDatadogExporter,
  DatadogValidationError,
  BatchConfig,
  QueueItem
} from './types.js';
import { DatadogHttpClient } from './http-client.js';
import { BatchProcessor } from './batch-processor.js';

/**
 * Comprehensive Datadog exporter for structured observability data
 */
export class DatadogExporter implements IDatadogExporter {
  private readonly config: DatadogConfig;
  private readonly httpClient: DatadogHttpClient;
  private readonly metricsProcessor: BatchProcessor;
  private readonly logsProcessor: BatchProcessor;
  private readonly tracesProcessor: BatchProcessor;
  private readonly eventsProcessor: BatchProcessor;
  private isClosed = false;

  constructor(config: DatadogConfig) {
    this.config = DatadogConfigSchema.parse(config);
    this.httpClient = new DatadogHttpClient(this.config);

    const batchConfig: BatchConfig = {
      maxSize: this.config.batchSize,
      maxWaitTime: this.config.flushInterval,
      retryAttempts: this.config.retries,
      retryDelay: 1000,
    };

    this.metricsProcessor = new BatchProcessor(
      batchConfig,
      async (items: QueueItem[]) => {
        const metrics = items
          .filter(item => item.type === 'metric')
          .map(item => item.data as Metric);
        
        if (metrics.length > 0) {
          await this.httpClient.sendMetrics(metrics);
        }
      }
    );

    this.logsProcessor = new BatchProcessor(
      batchConfig,
      async (items: QueueItem[]) => {
        const logs = items
          .filter(item => item.type === 'log')
          .map(item => item.data as Log);
        
        if (logs.length > 0) {
          await this.httpClient.sendLogs(logs);
        }
      }
    );

    this.tracesProcessor = new BatchProcessor(
      batchConfig,
      async (items: QueueItem[]) => {
        const traces = items
          .filter(item => item.type === 'trace')
          .map(item => item.data as Span);
        
        if (traces.length > 0) {
          await this.httpClient.sendTraces(traces);
        }
      }
    );

    this.eventsProcessor = new BatchProcessor(
      batchConfig,
      async (items: QueueItem[]) => {
        const events = items
          .filter(item => item.type === 'event')
          .map(item => item.data as Event);
        
        if (events.length > 0) {
          await this.httpClient.sendEvents(events);
        }
      }
    );
  }

  /**
   * Export metrics to Datadog
   */
  async exportMetrics(metrics: Metric[]): Promise<void> {
    if (this.isClosed) {
      throw new Error('Exporter is closed');
    }

    if (!this.config.enableMetrics) {
      return;
    }

    for (const metric of metrics) {
      this.validateMetric(metric);
      this.enrichMetric(metric);
      this.metricsProcessor.add({
        type: 'metric',
        data: metric,
      });
    }
  }

  /**
   * Export logs to Datadog
   */
  async exportLogs(logs: Log[]): Promise<void> {
    if (this.isClosed) {
      throw new Error('Exporter is closed');
    }

    if (!this.config.enableLogs) {
      return;
    }

    for (const log of logs) {
      this.validateLog(log);
      this.enrichLog(log);
      this.logsProcessor.add({
        type: 'log',
        data: log,
      });
    }
  }

  /**
   * Export traces to Datadog
   */
  async exportTraces(spans: Span[]): Promise<void> {
    if (this.isClosed) {
      throw new Error('Exporter is closed');
    }

    if (!this.config.enableTraces) {
      return;
    }

    for (const span of spans) {
      this.validateSpan(span);
      this.enrichSpan(span);
      this.tracesProcessor.add({
        type: 'trace',
        data: span,
      });
    }
  }

  /**
   * Export events to Datadog
   */
  async exportEvents(events: Event[]): Promise<void> {
    if (this.isClosed) {
      throw new Error('Exporter is closed');
    }

    for (const event of events) {
      this.validateEvent(event);
      this.enrichEvent(event);
      this.eventsProcessor.add({
        type: 'event',
        data: event,
      });
    }
  }

  /**
   * Flush all pending data
   */
  async flush(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    await Promise.all([
      this.metricsProcessor.flush(),
      this.logsProcessor.flush(),
      this.tracesProcessor.flush(),
      this.eventsProcessor.flush(),
    ]);
  }

  /**
   * Close the exporter and flush remaining data
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;

    await Promise.all([
      this.metricsProcessor.close(),
      this.logsProcessor.close(),
      this.tracesProcessor.close(),
      this.eventsProcessor.close(),
    ]);
  }

  /**
   * Validate metric data
   */
  private validateMetric(metric: Metric): void {
    try {
      z.object({
        metric: z.string().min(1),
        points: z.array(z.tuple([z.number(), z.number()])).min(1),
        tags: z.array(z.string()).optional(),
        host: z.string().optional(),
        type: z.enum(['count', 'gauge', 'rate', 'histogram', 'distribution']).optional(),
        interval: z.number().positive().optional(),
      }).parse(metric);
    } catch (error) {
      throw new DatadogValidationError(
        `Invalid metric: ${(error as z.ZodError).message}`,
        'metric'
      );
    }
  }

  /**
   * Validate log data
   */
  private validateLog(log: Log): void {
    try {
      z.object({
        message: z.string().min(1),
        timestamp: z.number().optional(),
        level: z.enum(['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug']).optional(),
        service: z.string().optional(),
        hostname: z.string().optional(),
        ddsource: z.string().optional(),
        ddtags: z.string().optional(),
        host: z.string().optional(),
        tags: z.array(z.string()).optional(),
        attributes: z.record(z.unknown()).optional(),
      }).parse(log);
    } catch (error) {
      throw new DatadogValidationError(
        `Invalid log: ${(error as z.ZodError).message}`,
        'log'
      );
    }
  }

  /**
   * Validate span data
   */
  private validateSpan(span: Span): void {
    try {
      z.object({
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
      }).parse(span);
    } catch (error) {
      throw new DatadogValidationError(
        `Invalid span: ${(error as z.ZodError).message}`,
        'span'
      );
    }
  }

  /**
   * Validate event data
   */
  private validateEvent(event: Event): void {
    try {
      z.object({
        title: z.string().min(1),
        text: z.string().min(1),
        date_happened: z.number().optional(),
        priority: z.enum(['normal', 'low']).optional(),
        host: z.string().optional(),
        tags: z.array(z.string()).optional(),
        alert_type: z.enum(['info', 'warning', 'error', 'success']).optional(),
        aggregation_key: z.string().optional(),
        source_type_name: z.string().optional(),
      }).parse(event);
    } catch (error) {
      throw new DatadogValidationError(
        `Invalid event: ${(error as z.ZodError).message}`,
        'event'
      );
    }
  }

  /**
   * Enrich metric with default values
   */
  private enrichMetric(metric: Metric): void {
    if (!metric.host && this.config.hostname) {
      metric.host = this.config.hostname;
    }

    if (this.config.tags && this.config.tags.length > 0) {
      metric.tags = [...(metric.tags || []), ...this.config.tags];
    }
  }

  /**
   * Enrich log with default values
   */
  private enrichLog(log: Log): void {
    if (!log.service && this.config.service) {
      log.service = this.config.service;
    }

    if (!log.hostname && this.config.hostname) {
      log.hostname = this.config.hostname;
    }

    if (!log.timestamp) {
      log.timestamp = Math.floor(Date.now() / 1000);
    }

    if (this.config.tags && this.config.tags.length > 0) {
      log.tags = [...(log.tags || []), ...this.config.tags];
    }
  }

  /**
   * Enrich span with default values
   */
  private enrichSpan(span: Span): void {
    if (!span.service && this.config.service) {
      span.service = this.config.service;
    }

    if (this.config.tags && this.config.tags.length > 0) {
      span.meta = {
        ...span.meta,
        ...Object.fromEntries(this.config.tags.map((tag: string) => {
          const [key, value] = tag.split(':');
          return [key, value || 'true'];
        })),
      };
    }
  }

  /**
   * Enrich event with default values
   */
  private enrichEvent(event: Event): void {
    if (!event.host && this.config.hostname) {
      event.host = this.config.hostname;
    }

    if (!event.date_happened) {
      event.date_happened = Math.floor(Date.now() / 1000);
    }

    if (this.config.tags && this.config.tags.length > 0) {
      event.tags = [...(event.tags || []), ...this.config.tags];
    }
  }

  /**
   * Get exporter statistics
   */
  getStats(): {
    metricsQueueSize: number;
    logsQueueSize: number;
    tracesQueueSize: number;
    eventsQueueSize: number;
    isProcessing: boolean;
    circuitBreakerState: string;
  } {
    return {
      metricsQueueSize: this.metricsProcessor.getQueueSize(),
      logsQueueSize: this.logsProcessor.getQueueSize(),
      tracesQueueSize: this.tracesProcessor.getQueueSize(),
      eventsQueueSize: this.eventsProcessor.getQueueSize(),
      isProcessing: 
        this.metricsProcessor.isCurrentlyProcessing() ||
        this.logsProcessor.isCurrentlyProcessing() ||
        this.tracesProcessor.isCurrentlyProcessing() ||
        this.eventsProcessor.isCurrentlyProcessing(),
      circuitBreakerState: this.httpClient.getCircuitBreakerState(),
    };
  }
} 