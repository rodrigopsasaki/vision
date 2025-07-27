import { vision } from "@rodrigopsasaki/vision";
import type { VisionExporter } from "@rodrigopsasaki/vision";
import { describe, test, expect, vi, beforeEach } from "vitest";

import { createVisionMiddleware } from "../src/middleware";


describe("Vision Express Integration", () => {
  let mockExporter: VisionExporter;

  beforeEach(() => {
    mockExporter = {
      name: "test-exporter",
      success: vi.fn(),
      error: vi.fn(),
    };

    vision.init({ exporters: [mockExporter] });
    vi.clearAllMocks();
  });

  test("creates middleware with proper configuration", () => {
    const middleware = createVisionMiddleware({
      captureRequestMetadata: true,
      captureResponseMetadata: true,
      captureHeaders: true,
      captureBody: false,
      captureQuery: true,
      captureParams: true,
      captureUserAgent: true,
      captureIp: true,
      captureTiming: true,
      redactSensitiveData: true,
    });

    expect(typeof middleware).toBe("function");
    expect(middleware.length).toBe(3); // req, res, next
  });

  test("creates middleware with custom context name generator", () => {
    const middleware = createVisionMiddleware({
      contextNameGenerator: (req) => `api.${req.method}.${req.path}`,
    });

    expect(typeof middleware).toBe("function");
  });

  test("creates middleware with custom route exclusion", () => {
    const middleware = createVisionMiddleware({
      shouldExcludeRoute: (req) => req.path.includes("/health"),
    });

    expect(typeof middleware).toBe("function");
  });

  test("creates middleware with custom metadata extraction", () => {
    const middleware = createVisionMiddleware({
      extractMetadata: (req) => ({
        service: "test-service",
        version: "1.0.0",
        path: req.path, // Use the parameter to avoid warning
      }),
    });

    expect(typeof middleware).toBe("function");
  });
}); 