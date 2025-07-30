import { describe, test, expect, vi } from "vitest";

import { vision } from "../src";
import type { VisionExporter } from "../src/core/types";

describe("vision.observe", () => {
  test("calls success on exporters", async () => {
    const success = vi.fn();

    const exporter: VisionExporter = {
      name: "test",
      success,
    };

    vision.init({ exporters: [exporter] });

    await vision.observe("observe-success", async () => {
      vision.set("key", "value");
    });

    expect(success).toHaveBeenCalledTimes(1);
  });

  test("calls error on exporters", async () => {
    const error = vi.fn();

    const exporter: VisionExporter = {
      name: "test",
      success: () => {},
      error,
    };

    vision.init({ exporters: [exporter] });

    await expect(
      vision.observe("observe-error", async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");

    expect(error).toHaveBeenCalledTimes(1);
  });

  test("fallbacks to success if error is missing", async () => {
    const success = vi.fn();

    const exporter: VisionExporter = {
      name: "fallback",
      success,
    };

    vision.init({ exporters: [exporter] });

    await expect(
      vision.observe("observe-fallback", async () => {
        throw new Error("no error handler");
      }),
    ).rejects.toThrow("no error handler");

    expect(success).toHaveBeenCalledTimes(1);
  });
});
