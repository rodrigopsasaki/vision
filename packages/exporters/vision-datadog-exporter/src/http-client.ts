import fetch from "node-fetch";

import type {
  DatadogConfig,
  Metric,
  Log,
  Span,
  Event,
  CircuitBreakerState,
  CircuitBreakerConfig,
} from "./types.js";
import { DatadogExportError } from "./types.js";

/**
 * HTTP client for sending data to Datadog API
 *
 * Implements circuit breaker pattern, retry logic, and proper error handling
 * for reliable data export to Datadog's various endpoints.
 */
export class DatadogHttpClient {
  private readonly config: DatadogConfig;
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  // Circuit breaker state
  private circuitBreakerState: CircuitBreakerState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly circuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    expectedErrors: ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"],
  };

  constructor(config: DatadogConfig) {
    this.config = config;
    this.baseUrl = `https://api.${config.site}`;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "DD-API-KEY": config.apiKey,
      ...(config.appKey && { "DD-APPLICATION-KEY": config.appKey }),
    };
  }

  /**
   * Send metrics to Datadog
   */
  async sendMetrics(metrics: Metric[]): Promise<void> {
    const payload = {
      series: metrics.map((metric) => ({
        metric: metric.metric,
        points: metric.points,
        tags: metric.tags,
        host: metric.host || this.config.hostname,
        type: metric.type,
        interval: metric.interval,
      })),
    };

    await this.makeRequest("/api/v1/series", payload);
  }

  /**
   * Send logs to Datadog
   */
  async sendLogs(logs: Log[]): Promise<void> {
    await this.makeRequest("/v1/input/" + this.config.apiKey, logs, {
      "Content-Type": "application/json",
    });
  }

  /**
   * Send traces to Datadog
   */
  async sendTraces(spans: Span[]): Promise<void> {
    // Group spans by trace_id to create proper traces
    const tracesMap = new Map<number, Span[]>();

    for (const span of spans) {
      const traceSpans = tracesMap.get(span.trace_id) || [];
      traceSpans.push(span);
      tracesMap.set(span.trace_id, traceSpans);
    }

    // Convert to traces array format
    const traces = Array.from(tracesMap.values());

    await this.makeRequest("/v0.3/traces", traces, {
      "Content-Type": "application/json",
      "Datadog-Meta-Lang": "javascript",
      "Datadog-Meta-Version": "1.0.0",
      "Datadog-Meta-Tracer-Version": "1.0.0",
    });
  }

  /**
   * Send events to Datadog
   */
  async sendEvents(events: Event[]): Promise<void> {
    // Events need to be sent one by one
    const promises = events.map((event) => this.makeRequest("/api/v1/events", event));

    await Promise.all(promises);
  }

  /**
   * Make HTTP request with circuit breaker, retries, and error handling
   */
  private async makeRequest(
    endpoint: string,
    data: unknown,
    additionalHeaders: Record<string, string> = {},
  ): Promise<void> {
    // Check circuit breaker
    if (this.circuitBreakerState === "open") {
      if (Date.now() - this.lastFailureTime > this.circuitBreakerConfig.recoveryTimeout) {
        this.circuitBreakerState = "half-open";
      } else {
        throw new DatadogExportError(
          "Circuit breaker is open",
          "CIRCUIT_BREAKER_OPEN",
          undefined,
          false,
        );
      }
    }

    const url = endpoint.startsWith("/v1/input")
      ? `https://http-intake.logs.${this.config.site}${endpoint}`
      : `${this.baseUrl}${endpoint}`;

    const headers = {
      ...this.defaultHeaders,
      ...additionalHeaders,
    };

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      const controller = new AbortController();
      let timeoutId: NodeJS.Timeout | undefined;

      try {
        timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new DatadogExportError(
            `HTTP ${response.status}: ${errorText}`,
            "HTTP_ERROR",
            response.status,
            this.isRetryableStatus(response.status),
          );

          this.handleFailure(error);
          throw error;
        }

        // Success - reset circuit breaker
        this.handleSuccess();
        return;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = error;

        // Don't retry on certain errors
        if (error instanceof DatadogExportError && !error.retryable) {
          this.handleFailure(error);
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    const finalError = new DatadogExportError(
      `Failed after ${this.config.retries + 1} attempts: ${lastError}`,
      "MAX_RETRIES_EXCEEDED",
      undefined,
      false,
    );

    this.handleFailure(finalError);
    throw finalError;
  }

  /**
   * Handle successful request
   */
  private handleSuccess(): void {
    this.failureCount = 0;
    this.circuitBreakerState = "closed";
  }

  /**
   * Handle failed request
   */
  private handleFailure(_error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.circuitBreakerConfig.failureThreshold) {
      this.circuitBreakerState = "open";
    }
  }

  /**
   * Check if HTTP status code is retryable
   */
  private isRetryableStatus(status: number): boolean {
    // Retry on server errors and rate limits
    return status >= 500 || status === 429 || status === 408;
  }

  /**
   * Get current circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreakerState;
  }

  /**
   * Get failure statistics
   */
  getStats(): {
    failureCount: number;
    circuitBreakerState: CircuitBreakerState;
    lastFailureTime: number;
  } {
    return {
      failureCount: this.failureCount,
      circuitBreakerState: this.circuitBreakerState,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
