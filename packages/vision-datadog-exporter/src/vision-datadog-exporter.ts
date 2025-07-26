import type { VisionContext, VisionExporter } from "@rodrigopsasaki/vision";
import { z } from "zod";

import { BatchProcessor } from "./batch-processor.js";
import { DatadogHttpClient } from "./http-client.js";
import { VisionDatadogTransformer } from "./transformer.js";
import {
  DatadogConfig,
  DatadogConfigSchema,
  VisionDatadogExporter as IVisionDatadogExporter,
  BatchConfig,
  QueueItem,
} from "./types.js";

/**
 * Datadog exporter for @rodrigopsasaki/vision
 *
 * This exporter integrates with the vision observability system to send
 * structured context data to Datadog. By default, it exports contexts as
 * traces with all metadata included as span metadata.
 */
export class VisionDatadogExporter implements VisionExporter, IVisionDatadogExporter {
  public readonly name = "datadog";

  private readonly config: DatadogConfig;
  private readonly httpClient: DatadogHttpClient;
  private readonly transformer: VisionDatadogTransformer;
  private readonly batchProcessor: BatchProcessor;
  private isClosed = false;

  constructor(config: z.input<typeof DatadogConfigSchema>) {
    this.config = DatadogConfigSchema.parse(config);
    this.httpClient = new DatadogHttpClient(this.config);
    this.transformer = new VisionDatadogTransformer(this.config);

    const batchConfig: BatchConfig = {
      maxSize: this.config.batchSize,
      maxWaitTime: this.config.flushInterval,
      retryAttempts: this.config.retries,
      retryDelay: 1000,
    };

    this.batchProcessor = new BatchProcessor(batchConfig, async (items: QueueItem[]) => {
      await this.processBatch(items);
    });
  }

  /**
   * Called when a vision context starts
   */
  before(context: VisionContext): void {
    if (this.isClosed) return;

    // Record start time for duration calculation
    this.transformer.recordStart(context);
  }

  /**
   * Called when a vision context completes successfully
   */
  success(context: VisionContext): void {
    if (this.isClosed) return;

    try {
      const data = this.transformContext(context);
      this.batchProcessor.add({
        type: this.config.exportMode,
        data,
      });
    } catch (error) {
      console.error("[vision-datadog-exporter] Error transforming context:", error);
    }
  }

  /**
   * Called when a vision context fails
   */
  error(context: VisionContext, err: unknown): void {
    if (this.isClosed) return;

    try {
      const data = this.transformContext(context, err);
      this.batchProcessor.add({
        type: this.config.exportMode,
        data,
      });
    } catch (error) {
      console.error("[vision-datadog-exporter] Error transforming error context:", error);
    }
  }

  /**
   * Called after successful execution
   */
  after(_context: VisionContext): void {
    // No additional cleanup needed
  }

  /**
   * Called after failed execution
   */
  onError(_context: VisionContext, _err: unknown): void {
    // Error handling is done in the error method
  }

  /**
   * Transform vision context to appropriate Datadog data format
   */
  private transformContext(context: VisionContext, error?: unknown) {
    switch (this.config.exportMode) {
      case "metric":
        return this.transformer.toMetric(context, error);
      case "log":
        return this.transformer.toLog(context, error);
      case "event":
        return this.transformer.toEvent(context, error);
      case "trace":
      default:
        return this.transformer.toSpan(context, error);
    }
  }

  /**
   * Process a batch of items
   */
  private async processBatch(items: QueueItem[]): Promise<void> {
    try {
      const metrics: any[] = [];
      const logs: any[] = [];
      const traces: any[] = [];
      const events: any[] = [];

      // Group items by type
      for (const item of items) {
        switch (item.type) {
          case "metric":
            metrics.push(item.data);
            break;
          case "log":
            logs.push(item.data);
            break;
          case "trace":
            traces.push(item.data);
            break;
          case "event":
            events.push(item.data);
            break;
        }
      }

      // Send each type to Datadog
      const promises: Promise<void>[] = [];

      if (metrics.length > 0) {
        promises.push(this.httpClient.sendMetrics(metrics));
      }

      if (logs.length > 0) {
        promises.push(this.httpClient.sendLogs(logs));
      }

      if (traces.length > 0) {
        promises.push(this.httpClient.sendTraces(traces));
      }

      if (events.length > 0) {
        promises.push(this.httpClient.sendEvents(events));
      }

      await Promise.all(promises);
    } catch (error) {
      console.error("[vision-datadog-exporter] Error processing batch:", error);
      throw error;
    }
  }

  /**
   * Flush all pending data
   */
  async flush(): Promise<void> {
    if (this.isClosed) return;
    await this.batchProcessor.flush();
  }

  /**
   * Close the exporter and flush remaining data
   */
  async close(): Promise<void> {
    if (this.isClosed) return;

    this.isClosed = true;
    await this.batchProcessor.close();
  }

  /**
   * Get exporter statistics
   */
  getStats(): {
    queueSize: number;
    isProcessing: boolean;
    circuitBreakerState: string;
  } {
    return {
      queueSize: this.batchProcessor.getQueueSize(),
      isProcessing: this.batchProcessor.isCurrentlyProcessing(),
      circuitBreakerState: this.httpClient.getCircuitBreakerState(),
    };
  }
}

/**
 * Create a Datadog exporter for vision with sensible defaults
 *
 * @param config - Datadog configuration
 * @returns A vision-compatible Datadog exporter
 *
 * @example
 * ```typescript
 * import { vision } from '@rodrigopsasaki/vision';
 * import { createDatadogExporter } from '@rodrigopsasaki/vision-datadog-exporter';
 *
 * // Initialize vision with Datadog exporter
 * vision.init({
 *   exporters: [
 *     createDatadogExporter({
 *       apiKey: 'your-datadog-api-key',
 *       service: 'my-service',
 *       env: 'production',
 *     })
 *   ]
 * });
 *
 * // Use vision contexts - they'll automatically be sent to Datadog
 * await vision.observe('user.login', async () => {
 *   vision.set('user_id', 'user123');
 *   vision.set('method', 'email');
 *   // ... work happens ...
 * });
 * ```
 */
export function createDatadogExporter(
  config: z.input<typeof DatadogConfigSchema>,
): VisionDatadogExporter {
  return new VisionDatadogExporter(config);
}

/**
 * Create a Datadog exporter with minimal configuration
 *
 * @param apiKey - Datadog API key
 * @param service - Service name
 * @param options - Additional configuration options
 * @returns A vision-compatible Datadog exporter
 *
 * @example
 * ```typescript
 * import { vision } from '@rodrigopsasaki/vision';
 * import { createSimpleDatadogExporter } from '@rodrigopsasaki/vision-datadog-exporter';
 *
 * vision.init({
 *   exporters: [
 *     createSimpleDatadogExporter(
 *       'your-datadog-api-key',
 *       'my-service',
 *       { env: 'production' }
 *     )
 *   ]
 * });
 * ```
 */
export function createSimpleDatadogExporter(
  apiKey: string,
  service: string,
  options: Partial<Omit<z.input<typeof DatadogConfigSchema>, "apiKey" | "service">> = {},
): VisionDatadogExporter {
  const config = {
    apiKey,
    service,
    ...options,
  };

  return new VisionDatadogExporter(config);
}
