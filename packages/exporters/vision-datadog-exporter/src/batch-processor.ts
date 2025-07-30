import { BatchConfig, QueueItem, DatadogExportError } from "./types.js";

/**
 * Batch processor for efficient data export
 *
 * Collects items in batches and processes them efficiently with configurable
 * batch size, flush intervals, and retry logic for failed batches.
 */
export class BatchProcessor {
  private readonly config: BatchConfig;
  private readonly processBatch: (items: QueueItem[]) => Promise<void>;

  private queue: QueueItem[] = [];
  private isProcessing = false;
  private isClosed = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private processingPromise: Promise<void> | null = null;

  constructor(config: BatchConfig, processBatch: (items: QueueItem[]) => Promise<void>) {
    this.config = config;
    this.processBatch = processBatch;
    this.scheduleFlush();
  }

  /**
   * Add an item to the batch queue
   */
  add(item: Omit<QueueItem, "id" | "timestamp" | "retryCount">): void {
    if (this.isClosed) {
      return;
    }

    const queueItem: QueueItem = {
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0,
      ...item,
    };

    this.queue.push(queueItem);

    // Process immediately if batch is full
    if (this.queue.length >= this.config.maxSize) {
      this.processImmediate();
    }
  }

  /**
   * Flush all pending items immediately
   */
  async flush(): Promise<void> {
    if (this.isClosed || this.queue.length === 0) {
      return;
    }

    // Cancel scheduled flush
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    await this.processImmediate();
  }

  /**
   * Close the processor and flush remaining items
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;

    // Cancel scheduled flush
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Process remaining items
    await this.flush();

    // Wait for any ongoing processing to complete
    if (this.processingPromise) {
      await this.processingPromise;
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Schedule automatic flush
   */
  private scheduleFlush(): void {
    if (this.isClosed || this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.processImmediate();
      this.scheduleFlush();
    }, this.config.maxWaitTime);
  }

  /**
   * Process items immediately
   */
  private processImmediate(): void {
    if (this.isProcessing || this.queue.length === 0 || this.isClosed) {
      return;
    }

    this.processingPromise = this.processQueue();
  }

  /**
   * Process the current queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Take items from queue
      const itemsToProcess = this.queue.splice(0, this.config.maxSize);

      if (itemsToProcess.length === 0) {
        return;
      }

      await this.processWithRetry(itemsToProcess);
    } catch (error) {
      console.error("[vision-datadog-exporter] Batch processing failed:", error);
    } finally {
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }

  /**
   * Process items with retry logic
   */
  private async processWithRetry(items: QueueItem[]): Promise<void> {
    try {
      await this.processBatch(items);
    } catch (error) {
      // Retry failed items
      const retryableItems = items.filter(
        (item) => item.retryCount < this.config.retryAttempts && this.isRetryableError(error),
      );

      if (retryableItems.length > 0) {
        // Increment retry count and re-queue
        for (const item of retryableItems) {
          item.retryCount++;
        }

        // Wait before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay * Math.pow(2, retryableItems[0].retryCount)),
        );

        // Add back to front of queue for retry
        this.queue.unshift(...retryableItems);
      }

      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof DatadogExportError) {
      return error.retryable;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Generate unique ID for queue items
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    queueSize: number;
    isProcessing: boolean;
    isClosed: boolean;
    hasScheduledFlush: boolean;
  } {
    return {
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
      isClosed: this.isClosed,
      hasScheduledFlush: this.flushTimer !== null,
    };
  }
}
