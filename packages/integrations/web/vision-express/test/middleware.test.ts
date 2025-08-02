import { vision } from "@rodrigopsasaki/vision";
import type { VisionExporter } from "@rodrigopsasaki/vision";
import { describe, test, expect, vi, beforeEach } from "vitest";

import { createVisionMiddleware } from "../src/middleware";

describe("createVisionMiddleware", () => {
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

  test("creates middleware function", () => {
    const middleware = createVisionMiddleware();
    expect(typeof middleware).toBe("function");
    expect(middleware.length).toBe(3); // req, res, next
  });

  test("creates middleware with custom options", () => {
    const middleware = createVisionMiddleware({
      captureBody: true,
      contextNameGenerator: (req) => `api.${req.method}.${req.path}`,
    });
    expect(typeof middleware).toBe("function");
  });

  test("creates minimal middleware", async () => {
    const { createMinimalVisionMiddleware } = await import("../src/middleware");
    const middleware = createMinimalVisionMiddleware();
    expect(typeof middleware).toBe("function");
  });

  test("creates comprehensive middleware", async () => {
    const { createComprehensiveVisionMiddleware } = await import("../src/middleware");
    const middleware = createComprehensiveVisionMiddleware();
    expect(typeof middleware).toBe("function");
  });
});
