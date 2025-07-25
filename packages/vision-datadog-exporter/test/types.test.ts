import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  DatadogConfigSchema,
  MetricSchema,
  LogSchema,
  SpanSchema,
  EventSchema,
  DatadogConfig,
  Metric,
  Log,
  Span,
  Event,
} from '../src/types.js';

describe('DatadogConfigSchema', () => {
  it('should validate a valid configuration', () => {
    const validConfig = {
      apiKey: 'test-api-key',
      service: 'test-service',
      site: 'datadoghq.com',
      env: 'production',
      version: '1.0.0',
      hostname: 'test-host',
      tags: ['env:production', 'service:test'],
      timeout: 5000,
      retries: 2,
      batchSize: 50,
      flushInterval: 3000,
      enableMetrics: true,
      enableLogs: true,
      enableTraces: true,
    };

    const result = DatadogConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should use default values for optional fields', () => {
    const minimalConfig = {
      apiKey: 'test-api-key',
      service: 'test-service',
    };

    const result = DatadogConfigSchema.parse(minimalConfig);
    expect(result.site).toBe('datadoghq.com');
    expect(result.timeout).toBe(10000);
    expect(result.retries).toBe(3);
    expect(result.batchSize).toBe(100);
    expect(result.flushInterval).toBe(5000);
    expect(result.enableMetrics).toBe(true);
    expect(result.enableLogs).toBe(true);
    expect(result.enableTraces).toBe(true);
  });

  it('should reject configuration without required fields', () => {
    const invalidConfig = {
      service: 'test-service',
    };

    const result = DatadogConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Required');
    }
  });

  it('should reject invalid site values', () => {
    const invalidConfig = {
      apiKey: 'test-api-key',
      service: 'test-service',
      site: 'invalid-site.com',
    };

    const result = DatadogConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });
});

describe('MetricSchema', () => {
  it('should validate a valid metric', () => {
    const validMetric = {
      metric: 'test.metric',
      points: [[Date.now() / 1000, 42.5]],
      tags: ['env:production'],
      host: 'test-host',
      type: 'gauge',
      interval: 60,
    };

    const result = MetricSchema.safeParse(validMetric);
    expect(result.success).toBe(true);
  });

  it('should use default type when not specified', () => {
    const metric = {
      metric: 'test.metric',
      points: [[Date.now() / 1000, 42.5]],
    };

    const result = MetricSchema.parse(metric);
    expect(result.type).toBe('gauge');
  });

  it('should reject metric without required fields', () => {
    const invalidMetric = {
      points: [[Date.now() / 1000, 42.5]],
    };

    const result = MetricSchema.safeParse(invalidMetric);
    expect(result.success).toBe(false);
  });

  it('should reject metric with invalid type', () => {
    const invalidMetric = {
      metric: 'test.metric',
      points: [[Date.now() / 1000, 42.5]],
      type: 'invalid-type',
    };

    const result = MetricSchema.safeParse(invalidMetric);
    expect(result.success).toBe(false);
  });
});

describe('LogSchema', () => {
  it('should validate a valid log', () => {
    const validLog = {
      message: 'Test log message',
      timestamp: Date.now() / 1000,
      level: 'info',
      service: 'test-service',
      hostname: 'test-host',
      ddsource: 'nodejs',
      ddtags: 'env:production',
      host: 'test-host',
      tags: ['env:production'],
      attributes: { userId: '123', action: 'login' },
    };

    const result = LogSchema.safeParse(validLog);
    expect(result.success).toBe(true);
  });

  it('should use default level when not specified', () => {
    const log = {
      message: 'Test log message',
    };

    const result = LogSchema.parse(log);
    expect(result.level).toBe('info');
  });

  it('should reject log without message', () => {
    const invalidLog = {
      level: 'info',
    };

    const result = LogSchema.safeParse(invalidLog);
    expect(result.success).toBe(false);
  });

  it('should reject log with invalid level', () => {
    const invalidLog = {
      message: 'Test log message',
      level: 'invalid-level',
    };

    const result = LogSchema.safeParse(invalidLog);
    expect(result.success).toBe(false);
  });
});

describe('SpanSchema', () => {
  it('should validate a valid span', () => {
    const validSpan = {
      trace_id: 123456789,
      span_id: 987654321,
      parent_id: 111111111,
      name: 'test.operation',
      resource: '/api/test',
      service: 'test-service',
      type: 'web',
      start: Date.now() * 1000000, // nanoseconds
      duration: 15000000, // 15ms in nanoseconds
      meta: { userId: '123' },
      metrics: { sampling_priority: 1 },
      error: 0,
    };

    const result = SpanSchema.safeParse(validSpan);
    expect(result.success).toBe(true);
  });

  it('should reject span without required fields', () => {
    const invalidSpan = {
      trace_id: 123456789,
      name: 'test.operation',
    };

    const result = SpanSchema.safeParse(invalidSpan);
    expect(result.success).toBe(false);
  });

  it('should reject span with negative duration', () => {
    const invalidSpan = {
      trace_id: 123456789,
      span_id: 987654321,
      name: 'test.operation',
      resource: '/api/test',
      service: 'test-service',
      start: Date.now() * 1000000,
      duration: -1000000,
    };

    const result = SpanSchema.safeParse(invalidSpan);
    expect(result.success).toBe(false);
  });
});

describe('EventSchema', () => {
  it('should validate a valid event', () => {
    const validEvent = {
      title: 'Test Event',
      text: 'This is a test event',
      date_happened: Date.now() / 1000,
      priority: 'normal',
      host: 'test-host',
      tags: ['env:production'],
      alert_type: 'info',
      aggregation_key: 'test-key',
      source_type_name: 'test-source',
    };

    const result = EventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('should use default values when not specified', () => {
    const event = {
      title: 'Test Event',
      text: 'This is a test event',
    };

    const result = EventSchema.parse(event);
    expect(result.priority).toBe('normal');
    expect(result.alert_type).toBe('info');
  });

  it('should reject event without required fields', () => {
    const invalidEvent = {
      title: 'Test Event',
    };

    const result = EventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('should reject event with invalid priority', () => {
    const invalidEvent = {
      title: 'Test Event',
      text: 'This is a test event',
      priority: 'invalid-priority',
    };

    const result = EventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });
}); 