import { describe, test, expect, beforeEach } from "vitest";

import { vision } from "../src";
import { serializeError, isErrorLike } from "../src/utils/errorCapture";

describe("error serialization", () => {
  test("handles standard Error instances", () => {
    const error = new Error("Something went wrong");
    const serialized = serializeError(error);

    expect(serialized.message).toBe("Something went wrong");
    expect(serialized.name).toBe("Error");
    expect(serialized.stack).toBeDefined();
    expect(serialized.errorType).toBe("Error");
  });

  test("handles Error subclasses", () => {
    const error = new TypeError("Invalid type");
    const serialized = serializeError(error);

    expect(serialized.message).toBe("Invalid type");
    expect(serialized.name).toBe("TypeError");
    expect(serialized.errorType).toBe("TypeError");
  });

  test("handles errors with custom properties", () => {
    const error = new Error("Custom error");
    (error as any).code = "ERR_CUSTOM";
    (error as any).statusCode = 400;
    (error as any).details = { field: "email" };

    const serialized = serializeError(error);

    expect(serialized.message).toBe("Custom error");
    expect(serialized.code).toBe("ERR_CUSTOM");
    expect(serialized.statusCode).toBe(400);
    expect(serialized.details).toEqual({ field: "email" });
  });

  test("handles errors with cause", () => {
    const cause = new Error("Root cause");
    const error = new Error("Wrapper error");
    (error as any).cause = cause;

    const serialized = serializeError(error);

    expect(serialized.message).toBe("Wrapper error");
    expect(serialized.cause).toEqual({
      message: "Root cause",
      name: "Error",
      stack: expect.any(String),
      errorType: "Error",
    });
  });

  test("handles string errors", () => {
    const serialized = serializeError("Something went wrong");

    expect(serialized.message).toBe("Something went wrong");
    expect(serialized.name).toBe("StringError");
    expect(serialized.originalValue).toBe("Something went wrong");
  });

  test("handles null and undefined", () => {
    const nullSerialized = serializeError(null);
    expect(nullSerialized.message).toBe("null");
    expect(nullSerialized.name).toBe("NullError");
    expect(nullSerialized.originalValue).toBe(null);

    const undefinedSerialized = serializeError(undefined);
    expect(undefinedSerialized.message).toBe("undefined");
    expect(undefinedSerialized.name).toBe("NullError");
    expect(undefinedSerialized.originalValue).toBe(undefined);
  });

  test("handles plain objects with error-like properties", () => {
    const errorLike = {
      message: "API Error",
      code: "API_ERROR",
      statusCode: 500,
      details: { endpoint: "/api/users" },
    };

    const serialized = serializeError(errorLike);

    expect(serialized.message).toBe("API Error");
    expect(serialized.name).toBe("API_ERROR");
    expect(serialized.code).toBe("API_ERROR");
    expect(serialized.statusCode).toBe(500);
    expect(serialized.details).toEqual({ endpoint: "/api/users" });
  });

  test("handles objects without error properties", () => {
    const obj = { foo: "bar", baz: 42 };
    const serialized = serializeError(obj);

    expect(serialized.message).toBe(JSON.stringify(obj));
    expect(serialized.name).toBe("ObjectError");
    expect(serialized.foo).toBe("bar");
    expect(serialized.baz).toBe(42);
  });

  test("handles circular references safely", () => {
    const obj: any = { message: "Circular error" };
    obj.self = obj;

    const serialized = serializeError(obj);

    expect(serialized.message).toBe("Circular error");
    expect(serialized.self).toBeUndefined(); // Circular reference is skipped
  });

  test("handles primitive errors", () => {
    expect(serializeError(42)).toEqual({
      message: "42",
      name: "numberError",
      originalValue: 42,
    });

    expect(serializeError(true)).toEqual({
      message: "true",
      name: "booleanError",
      originalValue: true,
    });

    const sym = Symbol("test");
    expect(serializeError(sym)).toEqual({
      message: "Symbol(test)",
      name: "symbolError",
      originalValue: "Symbol(test)",
    });
  });

  test("handles errors with non-enumerable properties", () => {
    const error = new Error("Test");
    Object.defineProperty(error, "hiddenProp", {
      value: "secret",
      enumerable: false,
    });

    const serialized = serializeError(error);

    expect(serialized.hiddenProp).toBe("secret");
  });

  test("handles errors with throwing getters", () => {
    const error = new Error("Test");
    Object.defineProperty(error, "throwingGetter", {
      get() {
        throw new Error("Getter throws!");
      },
      enumerable: true,
    });

    const serialized = serializeError(error);

    expect(serialized.message).toBe("Test");
    // Should not throw
  });
});

describe("error detection", () => {
  test("detects Error instances", () => {
    expect(isErrorLike(new Error())).toBe(true);
    expect(isErrorLike(new TypeError())).toBe(true);
    expect(isErrorLike(new RangeError())).toBe(true);
  });

  test("detects error-like objects", () => {
    expect(isErrorLike({ message: "error" })).toBe(true);
    expect(isErrorLike({ error: "something" })).toBe(true);
    expect(isErrorLike({ stack: "at foo" })).toBe(true);
    expect(isErrorLike({ code: "ERR_CODE" })).toBe(true);
    expect(isErrorLike({ errno: 1 })).toBe(true);
    expect(isErrorLike({ cause: "root" })).toBe(true);
  });

  test("detects objects with error-like names", () => {
    expect(isErrorLike({ name: "ValidationError" })).toBe(true);
    expect(isErrorLike({ type: "error" })).toBe(true);
    expect(isErrorLike({ type: "network_error" })).toBe(true);
  });

  test("does not detect regular objects", () => {
    expect(isErrorLike({})).toBe(false);
    expect(isErrorLike({ foo: "bar" })).toBe(false);
    expect(isErrorLike({ data: "value" })).toBe(false);
    expect(isErrorLike([])).toBe(false);
  });

  test("does not detect primitives", () => {
    expect(isErrorLike("string")).toBe(false);
    expect(isErrorLike(42)).toBe(false);
    expect(isErrorLike(true)).toBe(false);
    expect(isErrorLike(null)).toBe(false);
    expect(isErrorLike(undefined)).toBe(false);
  });
});

describe("vision error handling", () => {
  beforeEach(() => {
    vision.init();
  });

  test("automatically serializes errors in vision.set", async () => {
    const captured: any[] = [];
    vision.registerExporter({
      name: "test",
      success: (ctx) => captured.push(Object.fromEntries(ctx.data)),
    });

    await vision.observe("test", async () => {
      const error = new Error("Test error");
      (error as any).code = "TEST_ERR";

      vision.set("myError", error);
    });

    expect(captured[0].myError).toEqual({
      message: "Test error",
      name: "Error",
      stack: expect.any(String),
      code: "TEST_ERR",
      errorType: "Error",
    });
  });

  test("vision.error captures errors with metadata", async () => {
    const captured: any[] = [];
    vision.registerExporter({
      name: "test",
      success: (ctx) => captured.push(Object.fromEntries(ctx.data)),
    });

    await vision.observe("test", async () => {
      try {
        throw new TypeError("Invalid operation");
      } catch (err) {
        vision.error(err, {
          operation: "dataProcessing",
          fatal: false,
          userId: "user123",
        });
      }
    });

    const data = captured[0];
    expect(data.error).toEqual({
      message: "Invalid operation",
      name: "TypeError",
      stack: expect.any(String),
      errorType: "TypeError",
    });
    expect(data["error.fatal"]).toBe(false);
    expect(data["error.handled"]).toBe(true);
    expect(data["error.operation"]).toBe("dataProcessing");
    expect(data["error.metadata"]).toEqual({ userId: "user123" });
    expect(data["error.timestamp"]).toBeDefined();
  });

  test("vision.exception captures fatal errors", async () => {
    const captured: any[] = [];
    vision.registerExporter({
      name: "test",
      success: (ctx) => captured.push(Object.fromEntries(ctx.data)),
    });

    await vision.observe("test", async () => {
      vision.exception(new Error("Critical failure"), {
        operation: "startup",
      });
    });

    const data = captured[0];
    expect(data["error.fatal"]).toBe(true);
    expect(data["error.operation"]).toBe("startup");
  });

  test("handles weird error types gracefully", async () => {
    const captured: any[] = [];
    vision.registerExporter({
      name: "test",
      success: (ctx) => captured.push(Object.fromEntries(ctx.data)),
    });

    await vision.observe("test", async () => {
      // Test various weird things people throw
      vision.set("stringError", "Something went wrong");
      vision.set("numberError", 404);
      vision.set("booleanError", false);
      vision.set("nullError", null);

      // This should NOT be serialized (not error-like)
      vision.set("regularObject", { foo: "bar" });
    });

    const data = captured[0];

    // These should NOT be serialized as errors
    expect(data.stringError).toBe("Something went wrong");
    expect(data.numberError).toBe(404);
    expect(data.booleanError).toBe(false);
    expect(data.nullError).toBe(null);
    expect(data.regularObject).toEqual({ foo: "bar" });
  });

  test("preserves non-error values when using vision.set", async () => {
    const captured: any[] = [];
    vision.registerExporter({
      name: "test",
      success: (ctx) => captured.push(Object.fromEntries(ctx.data)),
    });

    await vision.observe("test", async () => {
      vision.set("string", "hello");
      vision.set("number", 42);
      vision.set("boolean", true);
      vision.set("array", [1, 2, 3]);
      vision.set("object", { nested: { value: "test" } });
    });

    const data = captured[0];
    expect(data.string).toBe("hello");
    expect(data.number).toBe(42);
    expect(data.boolean).toBe(true);
    expect(data.array).toEqual([1, 2, 3]);
    expect(data.object).toEqual({ nested: { value: "test" } });
  });
});
