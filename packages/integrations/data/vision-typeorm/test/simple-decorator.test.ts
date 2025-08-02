import { describe, it, expect, vi } from "vitest";
import { VisionInstrumented } from "../src/decorators";

describe("Simple Decorator Test", () => {
  it("should create a decorated class", () => {
    // This tests that the decorator can be applied without errors
    const decorator = VisionInstrumented();
    
    class TestClass {
      method() {
        return "test";
      }
    }
    
    const DecoratedClass = decorator(TestClass);
    const instance = new DecoratedClass();
    
    // The instance should still work
    expect(instance).toBeDefined();
    expect(typeof instance.method).toBe("function");
  });
});