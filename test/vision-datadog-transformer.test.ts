import { describe, it, expect } from 'vitest';
import { VisionDatadogTransformer } from '../src/transformer.js';
import { DatadogConfig } from '../src/types.js';

const baseConfig: DatadogConfig = {
  apiKey: 'key',
  service: 'svc',
  exportMode: 'trace',
  includeContextData: true,
  includeTiming: true,
  includeErrorDetails: true,
  batchSize: 10,
  flushInterval: 1000,
  retries: 1,
  timeout: 1000,
};

describe('VisionDatadogTransformer', () => {
  it('toMetric includes duration and tags', () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: '1', timestamp: '', name: 'foo', data: new Map([['a', 1]]) };
    transformer.recordStart(ctx);
    const metric = transformer.toMetric(ctx);
    expect(metric.metric).toBe('vision.context.duration');
    expect(metric.tags).toContain('vision.context.name:foo');
    expect(metric.tags).toContain('vision.data.a:1');
  });

  it('toLog includes context data and error', () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: '2', timestamp: '', name: 'bar', data: new Map([['b', 2]]) };
    transformer.recordStart(ctx);
    const log = transformer.toLog(ctx, new Error('fail'));
    expect(log.level).toBe('error');
    expect(log.attributes).toHaveProperty('errorName');
    expect(log.tags).toContain('vision.context.error:true');
  });

  it('toSpan includes meta and error', () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: '3', timestamp: '', name: 'baz', data: new Map([['c', 3]]) };
    transformer.recordStart(ctx);
    const span = transformer.toSpan(ctx, 'fail');
    expect(span.name).toBe('baz');
    expect(span.meta).toHaveProperty('vision.context.id');
    expect(span.error).toBe(1);
  });

  it('toEvent includes error and tags', () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: '4', timestamp: '', name: 'qux', data: new Map([['d', 4]]) };
    transformer.recordStart(ctx);
    const event = transformer.toEvent(ctx, 'fail');
    expect(event.title).toContain('Error');
    expect(event.tags).toContain('vision.context.error:true');
  });
}); 