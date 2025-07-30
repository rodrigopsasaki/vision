import { describe, test, expect } from "vitest";

import { vision } from "../src";

describe("context manipulation", () => {
  test("set and get work within observe", async () => {
    await vision.observe("ctx-get-set", async () => {
      vision.set("foo", 42);
      expect(vision.get("foo")).toBe(42);
    });
  });

  test("get returns undefined for unset keys", async () => {
    await vision.observe("ctx-get-undefined", async () => {
      expect(vision.get("missing")).toBeUndefined();
    });
  });

  test("push appends to an array", async () => {
    await vision.observe("ctx-push", async () => {
      vision.push("arr", "a");
      vision.push("arr", "b");
      expect(vision.get("arr")).toEqual(["a", "b"]);
    });
  });

  test("merge combines objects", async () => {
    await vision.observe("ctx-merge", async () => {
      vision.merge("meta", { a: 1 });
      vision.merge("meta", { b: 2 });
      expect(vision.get("meta")).toEqual({ a: 1, b: 2 });
    });
  });

  test("getContext throws outside of observe", () => {
    expect(() => vision.context()).toThrow("No active vision context");
  });
});
