import { describe, test, expect, vi } from "vitest";

import { vision } from "../src";

describe("vision.init", () => {
  test("registers and uses custom exporter", async () => {
    const success = vi.fn();

    vision.init({
      exporters: [
        {
          name: "custom",
          success,
        },
      ],
    });

    await vision.observe("custom-export", async () => {
      vision.set("x", 1);
    });

    expect(success).toHaveBeenCalled();
  });

  test("unregisters exporter", async () => {
    const fn = vi.fn();

    vision.init({
      exporters: [
        {
          name: "temp",
          success: fn,
        },
      ],
    });

    vision.unregisterExporter("temp");

    await vision.observe("should-not-fire", async () => {
      vision.set("y", 2);
    });

    expect(fn).not.toHaveBeenCalled();
  });
});
