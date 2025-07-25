import { QueueItem, BatchConfig } from './types.js';

/**
 * Batch processor for efficient data handling with automatic flushing and retry logic
 */
export class BatchProcessor {
  private readonly config: BatchConfig;
  private readonly queue: QueueItem[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly processFn: (items: QueueItem[]) => Promise<void>;

  constructor(
    config: BatchConfig,
    processFn: (items: QueueItem[]) => Promise<void>
  ) {
    this.config = config;
    this.processFn = processFn;
    this.scheduleFlush();
  }

  /**
   * Add item to batch queue
   */
  add(item: Omit<QueueItem, 'id' | 'timestamp' | 'retryCount'>): void {
    const queueItem: QueueItem = {
      ...item,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(queueItem);

    if (this.queue.length >= this.config.maxSize) {
      this.flush();
    }
  }

  /**
   * Flush all items in the queue
   */
  async flush(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.clearFlushTimer();

    try {
      const itemsToProcess = [...this.queue];
      this.queue.length = 0;

      await this.processBatch(itemsToProcess);
    } catch (error) {
      // Re-queue failed items for retry
      await this.handleBatchError(error as Error);
    } finally {
      this.isProcessing = false;
      this.scheduleFlush();
    }
  }

  /**
   * Process a batch of items
   */
  private async processBatch(items: QueueItem[]): Promise<void> {
    const batches = this.chunkArray(items, this.config.maxSize);

    for (const batch of batches) {
      try {
        await this.processFn(batch);
      } catch (error) {
        // Handle individual batch failures
        await this.handleBatchError(error as Error, batch);
      }
    }
  }

  /**
   * Handle batch processing errors
   */
  private async handleBatchError(error: Error, failedBatch?: QueueItem[]): Promise<void> {
    const itemsToRetry = failedBatch || this.queue.splice(0);

    for (const item of itemsToRetry) {
      if (item.retryCount < this.config.retryAttempts) {
        item.retryCount++;
        item.timestamp = Date.now();
        this.queue.push(item);
      } else {
        // Log final failure
        console.error(`Failed to process item after ${this.config.retryAttempts} attempts:`, {
          id: item.id,
          type: item.type,
          error: error.message,
        });
      }
    }

    // Wait before retrying and then retry immediately
    if (itemsToRetry.length > 0) {
      await this.delay(this.config.retryDelay);
      // Retry the failed items immediately
      await this.processBatch(this.queue.splice(0));
    }
  }

  /**
   * Schedule automatic flush
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flush().catch(error => {
        console.error('Error during scheduled flush:', error);
      });
    }, this.config.maxWaitTime);
  }

  /**
   * Clear flush timer
   */
  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Generate unique ID for queue items
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get processing status
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Close the batch processor
   */
  async close(): Promise<void> {
    this.clearFlushTimer();
    await this.flush();
  }
} 