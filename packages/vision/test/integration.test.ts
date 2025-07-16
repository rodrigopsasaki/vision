import { describe, test, expect, vi } from "vitest";

import { vision } from "../src";

describe("vision integration", () => {
  test("propagates context across async layers", async () => {
    vision.init();

    async function deep(): Promise<number> {
      await new Promise((r) => setTimeout(r, 1));
      return vision.get("user_id")!;
    }

    const result = await vision.observe("deep-call", async () => {
      vision.set("user_id", 123);
      return await deep();
    });

    expect(result).toBe(123);
  });

  test("runs multiple exporters together", async () => {
    const one = vi.fn();
    const two = vi.fn();

    vision.init({
      exporters: [
        { name: "one", success: one },
        { name: "two", success: two },
      ],
    });

    await vision.observe("fanOut", async () => {
      vision.set("a", 1);
    });

    expect(one).toHaveBeenCalled();
    expect(two).toHaveBeenCalled();
  });
});
