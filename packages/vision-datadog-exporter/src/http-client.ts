import fetch, { RequestInit, Response } from 'node-fetch';
import { DatadogConfig, DatadogExportError, CircuitBreakerState, CircuitBreakerConfig } from './types.js';

/**
 * HTTP client for Datadog API communication with retry logic and circuit breaker
 */
export class DatadogHttpClient {
  private readonly baseUrl: string;
  private readonly config: DatadogConfig;
  private circuitBreakerState: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly circuitBreakerConfig: CircuitBreakerConfig;

  constructor(config: DatadogConfig) {
    this.config = config;
    this.baseUrl = `https://api.${config.site}`;
    this.circuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      expectedErrors: ['429', '500', '502', '503', '504'],
    };
  }

  /**
   * Send metrics to Datadog API
   */
  async sendMetrics(metrics: unknown[]): Promise<void> {
    const url = `${this.baseUrl}/api/v1/series`;
    const payload = {
      series: metrics,
    };

    await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.apiKey,
        ...(this.config.appKey && { 'DD-APPLICATION-KEY': this.config.appKey }),
      },
    });
  }

  /**
   * Send logs to Datadog API
   */
  async sendLogs(logs: unknown[]): Promise<void> {
    const url = `${this.baseUrl}/api/v1/logs`;
    const payload = logs;

    await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.apiKey,
        ...(this.config.appKey && { 'DD-APPLICATION-KEY': this.config.appKey }),
      },
    });
  }

  /**
   * Send traces to Datadog API
   */
  async sendTraces(traces: unknown[]): Promise<void> {
    const url = `${this.baseUrl}/api/v0.2/traces`;
    const payload = traces;

    await this.makeRequest(url, {
      method: 'PUT',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.apiKey,
        ...(this.config.appKey && { 'DD-APPLICATION-KEY': this.config.appKey }),
      },
    });
  }

  /**
   * Send events to Datadog API
   */
  async sendEvents(events: unknown[]): Promise<void> {
    const url = `${this.baseUrl}/api/v1/events`;
    
    // Datadog events API only accepts one event at a time
    for (const event of events) {
      await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(event),
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.config.apiKey,
          ...(this.config.appKey && { 'DD-APPLICATION-KEY': this.config.appKey }),
        },
      });
    }
  }

  /**
   * Make HTTP request with retry logic and circuit breaker
   */
  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    if (this.circuitBreakerState === 'open') {
      if (Date.now() - this.lastFailureTime > this.circuitBreakerConfig.recoveryTimeout) {
        this.circuitBreakerState = 'half-open';
      } else {
        throw new DatadogExportError(
          'Circuit breaker is open',
          'CIRCUIT_BREAKER_OPEN',
          undefined,
          true
        );
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          timeout: this.config.timeout,
        });

        if (response.ok) {
          this.onSuccess();
          return response;
        }

        const errorMessage = await this.getErrorMessage(response);
        const error = new DatadogExportError(
          `HTTP ${response.status}: ${errorMessage}`,
          'HTTP_ERROR',
          response.status,
          this.isRetryableError(response.status)
        );

        if (!this.isRetryableError(response.status) || attempt === this.config.retries) {
          this.onFailure();
          throw error;
        }

        lastError = error;
        await this.delay(this.calculateBackoffDelay(attempt));

      } catch (error) {
        if (error instanceof DatadogExportError) {
          throw error;
        }

        const networkError = new DatadogExportError(
          `Network error: ${(error as Error).message}`,
          'NETWORK_ERROR',
          undefined,
          true
        );

        if (attempt === this.config.retries) {
          this.onFailure();
          throw networkError;
        }

        lastError = networkError;
        await this.delay(this.calculateBackoffDelay(attempt));
      }
    }

    this.onFailure();
    throw lastError || new Error('Unknown error occurred');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(statusCode: number): boolean {
    return this.circuitBreakerConfig.expectedErrors.includes(statusCode.toString());
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
  }

  /**
   * Extract error message from response
   */
  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.text();
      if (body) {
        try {
          const json = JSON.parse(body);
          return json.error || json.message || body;
        } catch {
          return body;
        }
      }
    } catch {
      // Ignore parsing errors
    }
    return response.statusText || 'Unknown error';
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    if (this.circuitBreakerState === 'half-open') {
      this.circuitBreakerState = 'closed';
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.circuitBreakerConfig.failureThreshold) {
      this.circuitBreakerState = 'open';
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreakerState;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
} 