import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockVisionContext } from "./setup";

// Mock the vision module with factory function
vi.mock("@rodrigopsasaki/vision", () => ({
  vision: new MockVisionContext(),
}));

import { VisionInstrumented, VisionObserve, VisionParam, VisionEntity } from "../src/decorators";
import { vision } from "@rodrigopsasaki/vision";

// Mock reflect-metadata
vi.mock("reflect-metadata", () => ({
  Reflect: {
    getMetadata: vi.fn(),
    defineMetadata: vi.fn(),
  },
}));

describe("VisionInstrumented decorator", () => {
  beforeEach(() => {
    (vision as any).clear();
  });

  it("should instrument all methods of a class", async () => {
    @VisionInstrumented()
    class TestRepository {
      async findUser(id: number) {
        return { id, name: "Test User" };
      }

      async saveUser(user: { name: string }) {
        return { id: 1, ...user };
      }
    }

    const repository = new TestRepository();

    // The decorator should handle the observe call
    await repository.findUser(1);

    const observeCalls = (vision as any).getObserveCalls();
    expect(observeCalls).toHaveLength(1);
    expect(observeCalls[0].name).toBe("db.test.findUser");
    expect(observeCalls[0].data.get("database.operation")).toBe("findUser");
    expect(observeCalls[0].data.get("database.entity")).toBe("test");
  });

  it("should not instrument when disabled", async () => {
    @VisionInstrumented({ enabled: false })
    class TestRepository {
      async findUser(id: number) {
        return { id, name: "Test User" };
      }
    }

    const repository = new TestRepository();
    const result = await repository.findUser(1);

    expect(result).toEqual({ id: 1, name: "Test User" });
    expect((vision as any).getObserveCalls()).toHaveLength(0);
  });
});

describe("VisionObserve decorator", () => {
  beforeEach(() => {
    (vision as any).clear();
  });

  it("should instrument individual methods", async () => {
    class TestRepository {
      @VisionObserve()
      async findUser(id: number) {
        return { id, name: "Test User" };
      }

      // This method should not be instrumented
      async regularMethod() {
        return "regular";
      }
    }

    const repository = new TestRepository();

    // Test instrumented method
    await repository.findUser(1);

    const observeCalls = (vision as any).getObserveCalls();
    expect(observeCalls).toHaveLength(1);
    expect(observeCalls[0].name).toBe("db.test.findUser");
    expect(observeCalls[0].data.get("database.operation")).toBe("findUser");

    // Test non-instrumented method
    (vision as any).clear();
    const result = await repository.regularMethod();
    expect(result).toBe("regular");
    expect((vision as any).getObserveCalls()).toHaveLength(0);
  });

  it("should not instrument when disabled", async () => {
    class TestRepository {
      @VisionObserve({ enabled: false })
      async findUser(id: number) {
        return { id, name: "Test User" };
      }
    }

    const repository = new TestRepository();
    const result = await repository.findUser(1);

    expect(result).toEqual({ id: 1, name: "Test User" });
    expect((vision as any).getObserveCalls()).toHaveLength(0);
  });
});

describe("VisionEntity decorator", () => {
  beforeEach(() => {
    (vision as any).clear();
  });

  it("should instrument entity lifecycle methods", async () => {
    @VisionEntity()
    class TestUser {
      id!: number;
      name!: string;

      async beforeInsert() {
        // Lifecycle method
        return Promise.resolve();
      }

      async afterLoad() {
        // Lifecycle method
        return Promise.resolve();
      }

      // Regular method should not be affected
      regularMethod() {
        return "regular";
      }
    }

    const user = new TestUser();
    user.name = "Test User";

    // Test that lifecycle methods are instrumented
    if (user.beforeInsert) {
      await user.beforeInsert();

      const observeCalls = (vision as any).getObserveCalls();
      expect(observeCalls).toHaveLength(1);
      expect(observeCalls[0].name).toBe("db.testuser.beforeInsert");
      expect(observeCalls[0].data.get("database.operation")).toBe("beforeInsert");
      expect(observeCalls[0].data.get("database.type")).toBe("entity_lifecycle");
    }

    // Test regular method is not affected
    expect(user.regularMethod()).toBe("regular");
  });

  it("should not instrument when disabled", async () => {
    @VisionEntity({ enabled: false })
    class TestUser {
      async beforeInsert() {
        return Promise.resolve();
      }
    }

    const user = new TestUser();
    await user.beforeInsert();

    expect((vision as any).getObserveCalls()).toHaveLength(0);
  });
});

describe("VisionParam decorator", () => {
  beforeEach(() => {
    (vision as any).clear();
    vi.clearAllMocks();
  });

  it("should mark parameters for capture", async () => {
    // This test verifies that the VisionParam decorator can be applied without errors
    // The actual metadata setting is tested in integration tests
    const { VisionParam } = await import("../src/decorators");

    // This should not throw an error
    expect(() => {
      class TestRepository {
        async findUser(@VisionParam("userId") id: number, @VisionParam("options") options?: any) {
          return { id, name: "Test User" };
        }
      }
      
      const repo = new TestRepository();
      expect(repo.findUser).toBeDefined();
    }).not.toThrow();
  });
});
