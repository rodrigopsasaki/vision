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

  test("executes exporter lifecycle hooks", async () => {
    const executionOrder: string[] = [];

    const exporter1 = {
      name: "first",
      success: vi.fn(),
      before: () => {
        executionOrder.push("first-before");
      },
      after: () => {
        executionOrder.push("first-after");
      },
      onError: () => {
        executionOrder.push("first-onError");
      },
    };

    const exporter2 = {
      name: "second",
      success: vi.fn(),
      before: () => {
        executionOrder.push("second-before");
      },
      after: () => {
        executionOrder.push("second-after");
      },
      onError: () => {
        executionOrder.push("second-onError");
      },
    };

    vision.init({
      exporters: [exporter1, exporter2],
    });

    await vision.observe("lifecycle-test", async () => {
      vision.set("test", "value");
      executionOrder.push("main-execution");
    });

    // Execution order should be: before (in order) -> execution -> after (in order)
    expect(executionOrder).toEqual([
      "first-before",
      "second-before",
      "main-execution",
      "first-after",
      "second-after",
    ]);

    // Exporters should still be called
    expect(exporter1.success).toHaveBeenCalled();
    expect(exporter2.success).toHaveBeenCalled();
  });

  test("executes onError hooks when exception occurs", async () => {
    const executionOrder: string[] = [];

    const exporter = {
      name: "error-handler",
      success: vi.fn(),
      error: vi.fn(),
      before: () => {
        executionOrder.push("before");
      },
      after: () => {
        executionOrder.push("after");
      },
      onError: () => {
        executionOrder.push("onError");
      },
    };

    vision.init({
      exporters: [exporter],
    });

    const testError = new Error("Test error");

    await expect(
      vision.observe("error-test", async () => {
        vision.set("test", "value");
        throw testError;
      }),
    ).rejects.toThrow("Test error");

    // Should execute before -> onError (not after)
    expect(executionOrder).toEqual(["before", "onError"]);
    expect(exporter.error).toHaveBeenCalled();
  });

  test("handles exporters without all hooks", async () => {
    const beforeCalled = vi.fn();
    const afterCalled = vi.fn();
    const onErrorCalled = vi.fn();

    const exporter = {
      name: "partial-exporter",
      success: vi.fn(),
      before: () => {
        beforeCalled();
      },
      // No after or onError hooks
    };

    vision.init({
      exporters: [exporter],
    });

    await vision.observe("partial-test", async () => {
      vision.set("test", "value");
    });

    expect(beforeCalled).toHaveBeenCalled();
    expect(afterCalled).not.toHaveBeenCalled();
    expect(onErrorCalled).not.toHaveBeenCalled();
    expect(exporter.success).toHaveBeenCalled();
  });

  test("handles hook errors gracefully", async () => {
    const beforeError = new Error("Before failed");
    const afterError = new Error("After failed");

    const exporter = {
      name: "error-exporter",
      success: vi.fn(),
      before: () => {
        throw beforeError;
      },
      after: () => {
        throw afterError;
      },
    };

    vision.init({
      exporters: [exporter],
    });

    // Should not throw the hook errors
    await expect(
      vision.observe("error-exporter-test", async () => {
        vision.set("test", "value");
      }),
    ).resolves.toBeUndefined();

    expect(exporter.success).toHaveBeenCalled();
  });

  test("works without lifecycle hooks", async () => {
    const exporter = {
      name: "no-hooks",
      success: vi.fn(),
      // No lifecycle hooks
    };

    vision.init({
      exporters: [exporter],
    });

    const result = await vision.observe("no-hooks-test", async () => {
      vision.set("test", "value");
      return "success";
    });

    expect(result).toBe("success");
    expect(exporter.success).toHaveBeenCalled();
  });
});
