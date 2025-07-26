import { VisionContext } from "@rodrigopsasaki/vision";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createDatadogExporter, VisionDatadogExporter } from "../src/vision-datadog-exporter.js";

// Mock HTTP client and batch processor
vi.mock("../src/http-client.js", () => ({
  DatadogHttpClient: vi.fn().mockImplementation(() => ({
    sendMetrics: vi.fn().mockResolvedValue(undefined),
    sendLogs: vi.fn().mockResolvedValue(undefined),
    sendTraces: vi.fn().mockResolvedValue(undefined),
    sendEvents: vi.fn().mockResolvedValue(undefined),
    getCircuitBreakerState: vi.fn().mockReturnValue("closed"),
  })),
}));
vi.mock("../src/batch-processor.js", () => ({
  BatchProcessor: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockReturnValue(0),
    isCurrentlyProcessing: vi.fn().mockReturnValue(false),
  })),
}));

describe("VisionDatadogExporter", () => {
  let exporter: VisionDatadogExporter;
  let context: VisionContext;

  beforeEach(() => {
    exporter = createDatadogExporter({
      apiKey: "test-key",
      service: "test-service",
      exportMode: "trace",
    });
    context = {
      id: "ctx1",
      timestamp: new Date().toISOString(),
      name: "test.context",
      data: new Map([["foo", "bar"]]),
    };
  });

  it("calls before and records start time", () => {
    expect(() => exporter.before?.(context)).not.toThrow();
  });

  it("exports a span on success (default)", () => {
    exporter.success(context);
    // Should add a span to the batch processor
    expect(exporter["batchProcessor"].add).toHaveBeenCalledWith(
      expect.objectContaining({ type: "trace" }),
    );
  });

  it("exports a span on error (default)", () => {
    exporter.error(context, new Error("fail"));
    expect(exporter["batchProcessor"].add).toHaveBeenCalledWith(
      expect.objectContaining({ type: "trace" }),
    );
  });

  it("exports a metric if exportMode is metric", () => {
    exporter = createDatadogExporter({
      apiKey: "test-key",
      service: "test-service",
      exportMode: "metric",
    });
    exporter.success(context);
    expect(exporter["batchProcessor"].add).toHaveBeenCalledWith(
      expect.objectContaining({ type: "metric" }),
    );
  });

  it("exports a log if exportMode is log", () => {
    exporter = createDatadogExporter({
      apiKey: "test-key",
      service: "test-service",
      exportMode: "log",
    });
    exporter.success(context);
    expect(exporter["batchProcessor"].add).toHaveBeenCalledWith(
      expect.objectContaining({ type: "log" }),
    );
  });

  it("exports an event if exportMode is event", () => {
    exporter = createDatadogExporter({
      apiKey: "test-key",
      service: "test-service",
      exportMode: "event",
    });
    exporter.success(context);
    expect(exporter["batchProcessor"].add).toHaveBeenCalledWith(
      expect.objectContaining({ type: "event" }),
    );
  });

  it("flush and close call batchProcessor methods", async () => {
    await expect(exporter.flush()).resolves.not.toThrow();
    await expect(exporter.close()).resolves.not.toThrow();
  });

  it("getStats returns correct structure", () => {
    const stats = exporter.getStats();
    expect(stats).toHaveProperty("queueSize");
    expect(stats).toHaveProperty("isProcessing");
    expect(stats).toHaveProperty("circuitBreakerState");
  });
});
