import type { VisionContext } from "@rodrigopsasaki/vision";

import { VisionToDatadogTransformer, Metric, Log, Span, Event, DatadogConfig } from "./types.js";

/**
 * Transforms Vision contexts into Datadog data formats
 */
export class VisionDatadogTransformer implements VisionToDatadogTransformer {
  private readonly config: DatadogConfig;
  private contextStartTimes: Map<string, number> = new Map();

  constructor(config: DatadogConfig) {
    this.config = config;
  }

  /**
   * Record the start time of a context for duration calculation
   */
  recordStart(context: VisionContext): void {
    this.contextStartTimes.set(context.id, Date.now());
  }

  /**
   * Calculate duration for a context
   */
  private getDuration(context: VisionContext): number {
    const startTime = this.contextStartTimes.get(context.id);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.contextStartTimes.delete(context.id);
    return duration;
  }

  /**
   * Convert context data Map to a flat object
   */
  private contextDataToObject(context: VisionContext): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of context.data.entries()) {
      // Handle nested objects and arrays
      if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          result[key] = value;
        } else {
          // Flatten nested objects
          Object.assign(result, this.flattenObject(value as Record<string, unknown>, key));
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Flatten nested objects with dot notation
   */
  private flattenObject(obj: Record<string, unknown>, prefix: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = `${prefix}.${key}`;

      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * Convert context to tags array
   */
  private contextToTags(context: VisionContext, error?: unknown): string[] {
    const tags: string[] = [
      `vision.context.name:${context.name}`,
      `vision.context.id:${context.id}`,
    ];

    if (context.scope) {
      tags.push(`vision.context.scope:${context.scope}`);
    }

    if (context.source) {
      tags.push(`vision.context.source:${context.source}`);
    }

    // Add global tags from config
    if (this.config.tags) {
      tags.push(...this.config.tags);
    }

    // Add error tag if present
    if (error) {
      tags.push("vision.context.error:true");
      if (error instanceof Error) {
        tags.push(`vision.error.type:${error.constructor.name}`);
      }
    }

    return tags;
  }

  /**
   * Convert Vision context to Datadog metric
   */
  toMetric(context: VisionContext, error?: unknown): Metric {
    const duration = this.getDuration(context);
    const tags = this.contextToTags(context, error);

    // Add context data as tags if enabled
    if (this.config.includeContextData) {
      const contextData = this.contextDataToObject(context);
      for (const [key, value] of Object.entries(contextData)) {
        if (value !== null && value !== undefined) {
          tags.push(`vision.data.${key}:${String(value)}`);
        }
      }
    }

    return {
      metric: "vision.context.duration",
      points: [[Date.now() / 1000, duration]],
      tags,
      host: this.config.hostname,
      type: "histogram",
    };
  }

  /**
   * Convert Vision context to Datadog log
   */
  toLog(context: VisionContext, error?: unknown): Log {
    const duration = this.getDuration(context);
    const tags = this.contextToTags(context, error);

    let message = `Vision context '${context.name}' completed`;
    let level: Log["level"] = "info";

    if (error) {
      message = `Vision context '${context.name}' failed: ${error instanceof Error ? error.message : String(error)}`;
      level = "error";
    }

    const attributes: Record<string, unknown> = {
      contextId: context.id,
      contextName: context.name,
      contextScope: context.scope,
      contextSource: context.source,
      timestamp: context.timestamp,
    };

    // Add context data if enabled
    if (this.config.includeContextData) {
      const contextData = this.contextDataToObject(context);
      Object.assign(attributes, contextData);
    }

    // Add timing if enabled
    if (this.config.includeTiming) {
      attributes.duration = duration;
    }

    // Add error details if enabled and present
    if (error && this.config.includeErrorDetails) {
      if (error instanceof Error) {
        attributes.errorName = error.name;
        attributes.errorMessage = error.message;
        attributes.errorStack = error.stack;
      } else {
        attributes.error = String(error);
      }
    }

    return {
      message,
      timestamp: Math.floor(Date.now() / 1000),
      level,
      service: this.config.service,
      hostname: this.config.hostname,
      ddsource: "vision",
      tags,
      attributes,
    };
  }

  /**
   * Convert Vision context to Datadog span
   */
  toSpan(context: VisionContext, error?: unknown): Span {
    const duration = this.getDuration(context);
    const startTime = Date.now() - duration;

    // Generate OpenTelemetry-compliant trace and span IDs
    const traceId = this.generateTraceId(context.id);
    const spanId = this.generateSpanId(context.id);

    const meta: Record<string, string> = {
      "vision.context.id": context.id,
      "vision.context.name": context.name,
      "otel.library.name": "vision",
      "otel.library.version": "1.0.0",
    };

    if (context.scope) {
      meta["vision.context.scope"] = context.scope;
      meta["span.kind"] = this.mapScopeToSpanKind(context.scope);
    }

    if (context.source) {
      meta["vision.context.source"] = context.source;
      meta["service.name"] = context.source;
    }

    // Add context data as metadata if enabled
    if (this.config.includeContextData) {
      const contextData = this.contextDataToObject(context);
      for (const [key, value] of Object.entries(contextData)) {
        if (value !== null && value !== undefined) {
          meta[`vision.data.${key}`] = String(value);
        }
      }
    }

    // Add error metadata if present
    if (error && this.config.includeErrorDetails) {
      meta["vision.error"] = "true";
      if (error instanceof Error) {
        meta["vision.error.name"] = error.name;
        meta["vision.error.message"] = error.message;
      } else {
        meta["vision.error.message"] = String(error);
      }
    }

    return {
      trace_id: traceId,
      span_id: spanId,
      name: context.name,
      resource: context.scope ? `${context.scope}:${context.name}` : context.name,
      service: this.config.service,
      type: context.scope || "vision",
      start: startTime * 1000000, // Convert to nanoseconds
      duration: duration * 1000000, // Convert to nanoseconds
      meta,
      error: error ? 1 : 0,
    };
  }

  /**
   * Convert Vision context to Datadog event
   */
  toEvent(context: VisionContext, error?: unknown): Event {
    this.getDuration(context); // Clear timing data
    const tags = this.contextToTags(context, error);

    let title = `Vision Context: ${context.name}`;
    let text = `Vision context '${context.name}' completed successfully`;
    let alertType: Event["alert_type"] = "info";
    let priority: Event["priority"] = "normal";

    if (error) {
      title = `Vision Context Error: ${context.name}`;
      text = `Vision context '${context.name}' failed: ${error instanceof Error ? error.message : String(error)}`;
      alertType = "error";
      priority = "normal";
    }

    return {
      title,
      text,
      date_happened: Math.floor(Date.now() / 1000),
      priority,
      host: this.config.hostname,
      tags,
      alert_type: alertType,
      aggregation_key: `vision.${context.name}`,
      source_type_name: "vision",
    };
  }

  /**
   * Map Vision context scope to OpenTelemetry span kind
   */
  private mapScopeToSpanKind(scope: string): string {
    const lowerScope = scope.toLowerCase();

    // Check more specific patterns first
    if (
      lowerScope.includes("client") ||
      lowerScope.includes("fetch") ||
      lowerScope.includes("call")
    ) {
      return "client";
    }
    if (lowerScope.includes("producer") || lowerScope.includes("publish")) {
      return "producer";
    }
    if (lowerScope.includes("consumer") || lowerScope.includes("subscribe")) {
      return "consumer";
    }
    if (
      lowerScope.includes("http") ||
      lowerScope.includes("api") ||
      lowerScope.includes("request")
    ) {
      return "server";
    }

    return "internal";
  }

  /**
   * Generate OpenTelemetry-compliant 64-bit trace ID from context ID
   */
  private generateTraceId(contextId: string): number {
    // Use a consistent hash of the context ID to generate trace ID
    const hash = this.hashToInt64(contextId);
    return Math.abs(hash);
  }

  /**
   * Generate OpenTelemetry-compliant 64-bit span ID from context ID
   */
  private generateSpanId(contextId: string): number {
    // Generate span ID by hashing context ID with a suffix
    const hash = this.hashToInt64(`${contextId}-span`);
    return Math.abs(hash);
  }

  /**
   * Hash string to 64-bit integer for OpenTelemetry ID generation
   */
  private hashToInt64(str: string): number {
    let hash = 0x811c9dc5; // FNV-1a offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0; // FNV-1a prime and ensure 32-bit
    }

    // Extend to 64-bit range for better distribution
    const high = hash ^ (hash >>> 16);
    const low = hash ^ (hash >>> 8);
    return high * 0x100000000 + low;
  }
}
