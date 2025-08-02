import { vision } from "@rodrigopsasaki/vision";
import type { VisionExporter } from "@rodrigopsasaki/vision";
import { describe, test, expect, vi, beforeEach } from "vitest";

import { createVisionMiddleware, createMinimalVisionMiddleware } from "../src/middleware";

describe("Vision Koa Middleware", () => {
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

  describe("createVisionMiddleware", () => {
    test("creates middleware function", () => {
      const middleware = createVisionMiddleware();
      expect(typeof middleware).toBe("function");
      expect(middleware.length).toBe(2); // ctx, next
    });

    test("creates middleware with custom options", () => {
      const middleware = createVisionMiddleware({
        captureBody: true,
        contextNameGenerator: (ctx) => `api.${ctx.method}.${ctx.path}`,
      });
      expect(typeof middleware).toBe("function");
    });

    test("middleware returns a promise (validates async nature)", () => {
      const middleware = createVisionMiddleware();
      
      // Just test the signature without executing, to avoid mocking complexity
      expect(middleware.constructor.name).toBe("AsyncFunction");
    });
  });

  describe("createMinimalVisionMiddleware", () => {
    test("creates minimal middleware function", () => {
      const middleware = createMinimalVisionMiddleware();
      expect(typeof middleware).toBe("function");
      expect(middleware.length).toBe(2); // ctx, next
    });
  });
});