import { describe, it, expect } from "vitest";

import { VisionDatadogTransformer } from "../src/transformer.js";
import { DatadogConfigSchema } from "../src/types.js";

const baseConfig = DatadogConfigSchema.parse({
  apiKey: "key",
  service: "svc",
  exportMode: "trace",
  includeContextData: true,
  includeTiming: true,
  includeErrorDetails: true,
  batchSize: 10,
  flushInterval: 1000,
  retries: 1,
  timeout: 1000,
});

describe("VisionDatadogTransformer", () => {
  it("toMetric includes duration and tags", () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: "1", timestamp: "", name: "foo", data: new Map([["a", 1]]) };
    transformer.recordStart(ctx);
    const metric = transformer.toMetric(ctx);
    expect(metric.metric).toBe("vision.context.duration");
    expect(metric.tags).toContain("vision.context.name:foo");
    expect(metric.tags).toContain("vision.data.a:1");
  });

  it("toLog includes context data and error", () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: "2", timestamp: "", name: "bar", data: new Map([["b", 2]]) };
    transformer.recordStart(ctx);
    const log = transformer.toLog(ctx, new Error("fail"));
    expect(log.level).toBe("error");
    expect(log.attributes).toHaveProperty("errorName");
    expect(log.tags).toContain("vision.context.error:true");
  });

  it("toSpan includes meta and error", () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: "3", timestamp: "", name: "baz", data: new Map([["c", 3]]) };
    transformer.recordStart(ctx);
    const span = transformer.toSpan(ctx, "fail");
    expect(span.name).toBe("baz");
    expect(span.meta).toHaveProperty("vision.context.id");
    expect(span.error).toBe(1);
  });

  it("toEvent includes error and tags", () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: "4", timestamp: "", name: "qux", data: new Map([["d", 4]]) };
    transformer.recordStart(ctx);
    const event = transformer.toEvent(ctx, "fail");
    expect(event.title).toContain("Error");
    expect(event.tags).toContain("vision.context.error:true");
  });

  it("toSpan includes OpenTelemetry-compliant metadata", () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = {
      id: "test-id",
      timestamp: "",
      name: "test-span",
      scope: "http",
      source: "test-service",
      data: new Map([["user_id", "123"]]),
    };
    transformer.recordStart(ctx);
    const span = transformer.toSpan(ctx);

    expect(span.meta).toHaveProperty("otel.library.name", "vision");
    expect(span.meta).toHaveProperty("otel.library.version", "1.0.0");
    expect(span.meta).toHaveProperty("span.kind", "server");
    expect(span.meta).toHaveProperty("service.name", "test-service");
    expect(span.meta).toHaveProperty("vision.data.user_id", "123");
  });

  it("toSpan maps scope to correct span kind", () => {
    const transformer = new VisionDatadogTransformer(baseConfig);

    const testCases = [
      { scope: "http-server", expected: "server" },
      { scope: "api-endpoint", expected: "server" },
      { scope: "http-client", expected: "client" },
      { scope: "fetch-request", expected: "client" },
      { scope: "message-producer", expected: "producer" },
      { scope: "event-consumer", expected: "consumer" },
      { scope: "database-query", expected: "internal" },
    ];

    for (const testCase of testCases) {
      const ctx = {
        id: `test-${testCase.scope}`,
        timestamp: "",
        name: "test",
        scope: testCase.scope,
        data: new Map(),
      };
      transformer.recordStart(ctx);
      const span = transformer.toSpan(ctx);
      expect(span.meta?.["span.kind"]).toBe(testCase.expected);
    }
  });

  it("generates consistent trace and span IDs", () => {
    const transformer = new VisionDatadogTransformer(baseConfig);
    const ctx = { id: "consistent-id", timestamp: "", name: "test", data: new Map() };

    transformer.recordStart(ctx);
    const span1 = transformer.toSpan(ctx);

    transformer.recordStart(ctx);
    const span2 = transformer.toSpan(ctx);

    // Same context ID should generate same trace/span IDs
    expect(span1.trace_id).toBe(span2.trace_id);
    expect(span1.span_id).toBe(span2.span_id);
    expect(span1.trace_id).not.toBe(span1.span_id);
  });
});
