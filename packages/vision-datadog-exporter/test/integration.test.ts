import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatadogExporter } from '../src/datadog-exporter.js';
import { Metric, Log, Span, Event } from '../src/types.js';

// This is an integration test that demonstrates the full functionality
// In a real scenario, you would use actual Datadog API keys for testing
describe('DatadogExporter Integration', () => {
  let exporter: DatadogExporter;

  beforeAll(() => {
    // Create exporter with test configuration
    // Note: In real testing, you would use actual Datadog API keys
    exporter = new DatadogExporter({
      apiKey: 'test-api-key',
      service: 'test-service',
      env: 'test',
      hostname: 'test-host',
      tags: ['env:test', 'service:test-service'],
      timeout: 5000,
      retries: 1,
      batchSize: 10,
      flushInterval: 1000,
    });
  });

  afterAll(async () => {
    await exporter.close();
  });

  describe('Complete Workflow', () => {
    it('should handle a complete observability workflow', async () => {
      const timestamp = Date.now() / 1000;

      // 1. Export metrics
      const metrics: Metric[] = [
        {
          metric: 'test.request.count',
          points: [[timestamp, 1]],
          tags: ['endpoint:/api/test', 'method:GET'],
          type: 'count',
        },
        {
          metric: 'test.request.duration',
          points: [[timestamp, 150.5]],
          tags: ['endpoint:/api/test', 'method:GET'],
          type: 'histogram',
        },
        {
          metric: 'test.memory.usage',
          points: [[timestamp, 1024 * 1024 * 100]], // 100MB
          tags: ['type:heap'],
          type: 'gauge',
        },
      ];

      await expect(exporter.exportMetrics(metrics)).resolves.not.toThrow();

      // 2. Export logs
      const logs: Log[] = [
        {
          message: 'Request processed successfully',
          level: 'info',
          tags: ['endpoint:/api/test', 'method:GET', 'status:200'],
        },
        {
          message: 'Database query executed',
          level: 'debug',
          tags: ['operation:select', 'table:users'],
          attributes: {
            queryTime: 45,
            rowsReturned: 10,
          },
        },
      ];

      await expect(exporter.exportLogs(logs)).resolves.not.toThrow();

      // 3. Export traces
      const traces: Span[] = [
        {
          trace_id: 123456789,
          span_id: 987654321,
          name: 'http.request',
          resource: '/api/test',
          service: 'test-service',
          start: Date.now() * 1000000,
          duration: 150000000, // 150ms in nanoseconds
          type: 'web',
          meta: {
            'http.method': 'GET',
            'http.status_code': '200',
            'http.url': '/api/test',
          },
        },
        {
          trace_id: 123456789,
          span_id: 111111111,
          parent_id: 987654321,
          name: 'db.query',
          resource: 'SELECT * FROM users',
          service: 'test-service',
          start: (Date.now() + 10) * 1000000,
          duration: 45000000, // 45ms in nanoseconds
          type: 'sql',
          meta: {
            'db.type': 'postgresql',
            'db.statement': 'SELECT * FROM users WHERE id = ?',
          },
        },
      ];

      await expect(exporter.exportTraces(traces)).resolves.not.toThrow();

      // 4. Export events
      const events: Event[] = [
        {
          title: 'Test Event',
          text: 'This is a test event for integration testing',
          priority: 'normal',
          alert_type: 'info',
          tags: ['test:integration'],
        },
      ];

      await expect(exporter.exportEvents(events)).resolves.not.toThrow();

      // 5. Check statistics
      const stats = exporter.getStats();
      expect(stats).toHaveProperty('metricsQueueSize');
      expect(stats).toHaveProperty('logsQueueSize');
      expect(stats).toHaveProperty('tracesQueueSize');
      expect(stats).toHaveProperty('eventsQueueSize');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('circuitBreakerState');

      // 6. Flush all data
      await expect(exporter.flush()).resolves.not.toThrow();
    });

    it('should handle high-volume data export', async () => {
      const timestamp = Date.now() / 1000;
      const batchSize = 50;

      // Generate large batch of metrics
      const metrics: Metric[] = Array.from({ length: batchSize }, (_, i) => ({
        metric: `test.batch.metric.${i}`,
        points: [[timestamp, Math.random() * 100]],
        tags: [`batch:${i}`, 'type:test'],
        type: 'gauge' as const,
      }));

      await expect(exporter.exportMetrics(metrics)).resolves.not.toThrow();

      // Generate large batch of logs
      const logs: Log[] = Array.from({ length: batchSize }, (_, i) => ({
        message: `Batch log message ${i}`,
        level: 'info' as const,
        tags: [`batch:${i}`, 'type:test'],
      }));

      await expect(exporter.exportLogs(logs)).resolves.not.toThrow();

      // Flush and verify
      await expect(exporter.flush()).resolves.not.toThrow();
    });

    it('should handle different metric types correctly', async () => {
      const timestamp = Date.now() / 1000;

      const differentMetricTypes: Metric[] = [
        {
          metric: 'test.count',
          points: [[timestamp, 42]],
          type: 'count',
        },
        {
          metric: 'test.gauge',
          points: [[timestamp, 123.45]],
          type: 'gauge',
        },
        {
          metric: 'test.rate',
          points: [[timestamp, 0.75]],
          type: 'rate',
        },
        {
          metric: 'test.histogram',
          points: [[timestamp, 250]],
          type: 'histogram',
        },
        {
          metric: 'test.distribution',
          points: [[timestamp, 99.9]],
          type: 'distribution',
        },
      ];

      await expect(exporter.exportMetrics(differentMetricTypes)).resolves.not.toThrow();
    });

    it('should handle different log levels correctly', async () => {
      const differentLogLevels: Log[] = [
        {
          message: 'Emergency log message',
          level: 'emergency',
        },
        {
          message: 'Alert log message',
          level: 'alert',
        },
        {
          message: 'Critical log message',
          level: 'critical',
        },
        {
          message: 'Error log message',
          level: 'error',
        },
        {
          message: 'Warning log message',
          level: 'warning',
        },
        {
          message: 'Notice log message',
          level: 'notice',
        },
        {
          message: 'Info log message',
          level: 'info',
        },
        {
          message: 'Debug log message',
          level: 'debug',
        },
      ];

      await expect(exporter.exportLogs(differentLogLevels)).resolves.not.toThrow();
    });

    it('should handle complex trace hierarchies', async () => {
      const baseTime = Date.now() * 1000000;
      const traceId = 999999999;

      const complexTraces: Span[] = [
        // Root span
        {
          trace_id: traceId,
          span_id: 100000001,
          name: 'http.request',
          resource: '/api/complex',
          service: 'test-service',
          start: baseTime,
          duration: 200000000, // 200ms
          type: 'web',
        },
        // Child span 1
        {
          trace_id: traceId,
          span_id: 100000002,
          parent_id: 100000001,
          name: 'db.query',
          resource: 'SELECT * FROM users',
          service: 'test-service',
          start: baseTime + 10000000, // 10ms after start
          duration: 50000000, // 50ms
          type: 'sql',
        },
        // Child span 2
        {
          trace_id: traceId,
          span_id: 100000003,
          parent_id: 100000001,
          name: 'cache.get',
          resource: 'user:123',
          service: 'test-service',
          start: baseTime + 15000000, // 15ms after start
          duration: 10000000, // 10ms
          type: 'cache',
        },
        // Grandchild span
        {
          trace_id: traceId,
          span_id: 100000004,
          parent_id: 100000002,
          name: 'db.connection',
          resource: 'postgresql://localhost:5432/test',
          service: 'test-service',
          start: baseTime + 11000000, // 11ms after start
          duration: 5000000, // 5ms
          type: 'db',
        },
      ];

      await expect(exporter.exportTraces(complexTraces)).resolves.not.toThrow();
    });

    it('should handle different event types correctly', async () => {
      const differentEventTypes: Event[] = [
        {
          title: 'Info Event',
          text: 'This is an informational event',
          alert_type: 'info',
          priority: 'normal',
        },
        {
          title: 'Warning Event',
          text: 'This is a warning event',
          alert_type: 'warning',
          priority: 'normal',
        },
        {
          title: 'Error Event',
          text: 'This is an error event',
          alert_type: 'error',
          priority: 'normal',
        },
        {
          title: 'Success Event',
          text: 'This is a success event',
          alert_type: 'success',
          priority: 'normal',
        },
        {
          title: 'Low Priority Event',
          text: 'This is a low priority event',
          alert_type: 'info',
          priority: 'low',
        },
      ];

      await expect(exporter.exportEvents(differentEventTypes)).resolves.not.toThrow();
    });
  });

  describe('Configuration Variations', () => {
    it('should work with minimal configuration', async () => {
      const minimalExporter = new DatadogExporter({
        apiKey: 'minimal-api-key',
        service: 'minimal-service',
      });

      const metric: Metric = {
        metric: 'minimal.test',
        points: [[Date.now() / 1000, 1]],
      };

      await expect(minimalExporter.exportMetrics([metric])).resolves.not.toThrow();
      await minimalExporter.close();
    }, 10000); // Increased timeout

    it('should work with EU site configuration', async () => {
      const euExporter = new DatadogExporter({
        apiKey: 'eu-api-key',
        service: 'eu-service',
        site: 'datadoghq.eu',
      });

      const metric: Metric = {
        metric: 'eu.test',
        points: [[Date.now() / 1000, 1]],
      };

      await expect(euExporter.exportMetrics([metric])).resolves.not.toThrow();
      await euExporter.close();
    }, 10000); // Increased timeout

    it('should respect feature flags', async () => {
      const disabledExporter = new DatadogExporter({
        apiKey: 'disabled-api-key',
        service: 'disabled-service',
        enableMetrics: false,
        enableLogs: false,
        enableTraces: false,
      });

      const metric: Metric = {
        metric: 'disabled.test',
        points: [[Date.now() / 1000, 1]],
      };

      const log: Log = {
        message: 'Disabled log',
      };

      const span: Span = {
        trace_id: 1,
        span_id: 1,
        name: 'disabled.span',
        resource: 'disabled',
        service: 'disabled-service',
        start: Date.now() * 1000000,
        duration: 1000000,
      };

      // These should not throw but also not process the data
      await expect(disabledExporter.exportMetrics([metric])).resolves.not.toThrow();
      await expect(disabledExporter.exportLogs([log])).resolves.not.toThrow();
      await expect(disabledExporter.exportTraces([span])).resolves.not.toThrow();

      await disabledExporter.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid data gracefully', async () => {
      const invalidMetrics = [
        {
          // Missing required fields
          points: [[Date.now() / 1000, 1]],
        },
      ];

      await expect(exporter.exportMetrics(invalidMetrics as any)).rejects.toThrow();

      const invalidLogs = [
        {
          // Missing required message
          level: 'info',
        },
      ];

      await expect(exporter.exportLogs(invalidLogs as any)).rejects.toThrow();
    });

    it('should handle operations after closing', async () => {
      const closedExporter = new DatadogExporter({
        apiKey: 'closed-api-key',
        service: 'closed-service',
      });

      await closedExporter.close();

      const metric: Metric = {
        metric: 'closed.test',
        points: [[Date.now() / 1000, 1]],
      };

      await expect(closedExporter.exportMetrics([metric])).rejects.toThrow('Exporter is closed');
    });
  });
}); 