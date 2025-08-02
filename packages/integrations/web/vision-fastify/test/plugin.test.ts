import { vision } from "@rodrigopsasaki/vision";
import type { VisionExporter } from "@rodrigopsasaki/vision";
import { describe, test, expect, vi, beforeEach } from "vitest";

import { visionPlugin, createMinimalVisionPlugin } from "../src/plugin";

describe("Vision Fastify Plugin", () => {
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

  describe("visionPlugin", () => {
    test("creates plugin function", () => {
      expect(typeof visionPlugin).toBe("function");
    });

    test("plugin has correct fastify plugin properties", () => {
      expect(visionPlugin[Symbol.for("fastify.display-name")]).toBe("vision-plugin");
      expect(visionPlugin[Symbol.for("skip-override")]).toBe(true);
    });

    test("plugin function is async", () => {
      // Test that the plugin is an async function without executing
      expect(visionPlugin.constructor.name).toBe("AsyncFunction");
    });
  });

  describe("createMinimalVisionPlugin", () => {
    test("creates minimal plugin function", () => {
      const plugin = createMinimalVisionPlugin();
      expect(typeof plugin).toBe("function");
    });

    test("minimal plugin has correct properties", () => {
      const plugin = createMinimalVisionPlugin();
      expect(plugin[Symbol.for("fastify.display-name")]).toBe("vision-minimal-plugin");
    });
  });
});