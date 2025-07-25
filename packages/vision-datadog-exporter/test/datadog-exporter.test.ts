import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatadogExporter } from '../src/datadog-exporter.js';
import { DatadogConfig, Metric, Log, Span, Event, DatadogValidationError } from '../src/types.js';

// Mock the HTTP client
vi.mock('../src/http-client.js', () => ({
  DatadogHttpClient: vi.fn().mockImplementation(() => ({
    sendMetrics: vi.fn().mockResolvedValue(undefined),
    sendLogs: vi.fn().mockResolvedValue(undefined),
    sendTraces: vi.fn().mockResolvedValue(undefined),
    sendEvents: vi.fn().mockResolvedValue(undefined),
    getCircuitBreakerState: vi.fn().mockReturnValue('closed'),
  })),
}));

// Mock the batch processor
vi.mock('../src/batch-processor.js', () => ({
  BatchProcessor: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockReturnValue(0),
    isCurrentlyProcessing: vi.fn().mockReturnValue(false),
  })),
}));

describe('DatadogExporter', () => {
  let exporter: DatadogExporter;
  let config: DatadogConfig;

  beforeEach(() => {
    config = {
      apiKey: 'test-api-key',
      appKey: 'test-app-key',
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

    exporter = new DatadogExporter(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create exporter with valid configuration', () => {
      expect(exporter).toBeInstanceOf(DatadogExporter);
    });

    it('should use default values for optional configuration', () => {
      const minimalConfig = {
        apiKey: 'test-api-key',
        service: 'test-service',
        site: 'datadoghq.com' as const,
        timeout: 10000,
        retries: 3,
        batchSize: 100,
        flushInterval: 5000,
        enableMetrics: true,
        enableLogs: true,
        enableTraces: true,
      };

      const minimalExporter = new DatadogExporter(minimalConfig);
      expect(minimalExporter).toBeInstanceOf(DatadogExporter);
    });

    it('should throw error for invalid configuration', () => {
      const invalidConfig = {
        service: 'test-service',
        // Missing apiKey
      };

      expect(() => new DatadogExporter(invalidConfig as any)).toThrow();
    });
  });

  describe('exportMetrics', () => {
    it('should export valid metrics', async () => {
      const metrics: Metric[] = [
        {
          metric: 'test.metric',
          points: [[Date.now() / 1000, 42.5]],
          tags: ['env:production'],
        },
      ];

      await expect(exporter.exportMetrics(metrics)).resolves.not.toThrow();
    });

    it('should not export metrics when disabled', async () => {
      const disabledExporter = new DatadogExporter({
        ...config,
        enableMetrics: false,
      });

      const metrics: Metric[] = [
        {
          metric: 'test.metric',
          points: [[Date.now() / 1000, 42.5]],
        },
      ];

      await expect(disabledExporter.exportMetrics(metrics)).resolves.not.toThrow();
    });

    it('should throw error for invalid metric', async () => {
      const invalidMetrics = [
        {
          // Missing required fields
          points: [[Date.now() / 1000, 42.5]],
        },
      ];

      await expect(exporter.exportMetrics(invalidMetrics as any)).rejects.toThrow(DatadogValidationError);
    });

    it('should enrich metrics with default values', async () => {
      const metrics: Metric[] = [
        {
          metric: 'test.metric',
          points: [[Date.now() / 1000, 42.5]],
        },
      ];

      await exporter.exportMetrics(metrics);

      // The metric should be enriched with hostname and tags from config
      expect(metrics[0].host).toBe('test-host');
      expect(metrics[0].tags).toEqual(['env:production', 'service:test']);
    });
  });

  describe('exportLogs', () => {
    it('should export valid logs', async () => {
      const logs: Log[] = [
        {
          message: 'Test log message',
          level: 'info',
          service: 'test-service',
        },
      ];

      await expect(exporter.exportLogs(logs)).resolves.not.toThrow();
    });

    it('should not export logs when disabled', async () => {
      const disabledExporter = new DatadogExporter({
        ...config,
        enableLogs: false,
      });

      const logs: Log[] = [
        {
          message: 'Test log message',
          level: 'info',
        },
      ];

      await expect(disabledExporter.exportLogs(logs)).resolves.not.toThrow();
    });

    it('should throw error for invalid log', async () => {
      const invalidLogs = [
        {
          // Missing required message field
          level: 'info',
        },
      ];

      await expect(exporter.exportLogs(invalidLogs as any)).rejects.toThrow(DatadogValidationError);
    });

    it('should enrich logs with default values', async () => {
      const logs: Log[] = [
        {
          message: 'Test log message',
        },
      ];

      await exporter.exportLogs(logs);

      expect(logs[0].service).toBe('test-service');
      expect(logs[0].hostname).toBe('test-host');
      expect(logs[0].timestamp).toBeDefined();
      expect(logs[0].tags).toEqual(['env:production', 'service:test']);
    });
  });

  describe('exportTraces', () => {
    it('should export valid traces', async () => {
      const spans: Span[] = [
        {
          trace_id: 123456789,
          span_id: 987654321,
          name: 'test.operation',
          resource: '/api/test',
          service: 'test-service',
          start: Date.now() * 1000000,
          duration: 15000000,
        },
      ];

      await expect(exporter.exportTraces(spans)).resolves.not.toThrow();
    });

    it('should not export traces when disabled', async () => {
      const disabledExporter = new DatadogExporter({
        ...config,
        enableTraces: false,
      });

      const spans: Span[] = [
        {
          trace_id: 123456789,
          span_id: 987654321,
          name: 'test.operation',
          resource: '/api/test',
          service: 'test-service',
          start: Date.now() * 1000000,
          duration: 15000000,
        },
      ];

      await expect(disabledExporter.exportTraces(spans)).resolves.not.toThrow();
    });

    it('should throw error for invalid span', async () => {
      const invalidSpans = [
        {
          trace_id: 123456789,
          // Missing required fields
        },
      ];

      await expect(exporter.exportTraces(invalidSpans as any)).rejects.toThrow(DatadogValidationError);
    });

    it('should enrich spans with default values', async () => {
      const spans: Span[] = [
        {
          trace_id: 123456789,
          span_id: 987654321,
          name: 'test.operation',
          resource: '/api/test',
          service: 'test-service', // Required field
          start: Date.now() * 1000000,
          duration: 15000000,
        },
      ];

      await exporter.exportTraces(spans);

      expect(spans[0].service).toBe('test-service');
      expect(spans[0].meta).toBeDefined();
    });
  });

  describe('exportEvents', () => {
    it('should export valid events', async () => {
      const events: Event[] = [
        {
          title: 'Test Event',
          text: 'This is a test event',
          priority: 'normal',
        },
      ];

      await expect(exporter.exportEvents(events)).resolves.not.toThrow();
    });

    it('should throw error for invalid event', async () => {
      const invalidEvents = [
        {
          title: 'Test Event',
          // Missing required text field
        },
      ];

      await expect(exporter.exportEvents(invalidEvents as any)).rejects.toThrow(DatadogValidationError);
    });

    it('should enrich events with default values', async () => {
      const events: Event[] = [
        {
          title: 'Test Event',
          text: 'This is a test event',
        },
      ];

      await exporter.exportEvents(events);

      expect(events[0].host).toBe('test-host');
      expect(events[0].date_happened).toBeDefined();
      expect(events[0].tags).toEqual(['env:production', 'service:test']);
    });
  });

  describe('flush', () => {
    it('should flush all processors', async () => {
      await expect(exporter.flush()).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('should close exporter and flush remaining data', async () => {
      await expect(exporter.close()).resolves.not.toThrow();
    });

    it('should not allow operations after closing', async () => {
      await exporter.close();

      const metrics: Metric[] = [
        {
          metric: 'test.metric',
          points: [[Date.now() / 1000, 42.5]],
        },
      ];

      await expect(exporter.exportMetrics(metrics)).rejects.toThrow('Exporter is closed');
    });
  });

  describe('getStats', () => {
    it('should return exporter statistics', () => {
      const stats = exporter.getStats();

      expect(stats).toHaveProperty('metricsQueueSize');
      expect(stats).toHaveProperty('logsQueueSize');
      expect(stats).toHaveProperty('tracesQueueSize');
      expect(stats).toHaveProperty('eventsQueueSize');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('circuitBreakerState');
    });
  });

  describe('validation', () => {
    it('should validate metric type', async () => {
      const invalidMetrics = [
        {
          metric: 'test.metric',
          points: [[Date.now() / 1000, 42.5]],
          type: 'invalid-type',
        },
      ];

      await expect(exporter.exportMetrics(invalidMetrics as any)).rejects.toThrow(DatadogValidationError);
    });

    it('should validate log level', async () => {
      const invalidLogs = [
        {
          message: 'Test log message',
          level: 'invalid-level',
        },
      ];

      await expect(exporter.exportLogs(invalidLogs as any)).rejects.toThrow(DatadogValidationError);
    });

    it('should validate span duration', async () => {
      const invalidSpans = [
        {
          trace_id: 123456789,
          span_id: 987654321,
          name: 'test.operation',
          resource: '/api/test',
          service: 'test-service',
          start: Date.now() * 1000000,
          duration: -1000000, // Negative duration
        },
      ];

      await expect(exporter.exportTraces(invalidSpans as any)).rejects.toThrow(DatadogValidationError);
    });

    it('should validate event priority', async () => {
      const invalidEvents = [
        {
          title: 'Test Event',
          text: 'This is a test event',
          priority: 'invalid-priority',
        },
      ];

      await expect(exporter.exportEvents(invalidEvents as any)).rejects.toThrow(DatadogValidationError);
    });
  });
}); 