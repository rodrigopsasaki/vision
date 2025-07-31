import { describe, it, expect, beforeEach, vi } from "vitest";
import { VisionInstrumented, VisionObserve, VisionParam, VisionEntity } from "../src/decorators";
import { MockVisionContext } from "./setup";

// Create mock vision instance
const mockVision = new MockVisionContext();

// Mock the vision module
vi.mock("@rodrigopsasaki/vision", () => ({
  vision: mockVision,
}));

// Mock reflect-metadata
vi.mock("reflect-metadata", () => ({
  Reflect: {
    getMetadata: vi.fn(),
    defineMetadata: vi.fn(),
  },
}));

describe("VisionInstrumented decorator", () => {
  beforeEach(() => {
    mockVision.clear();
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

    await mockVision.observe("test", async () => {
      await repository.findUser(1);
    });

    const lastCall = mockVision.getLastCall();
    expect(lastCall?.name).toBe("db.test.find");
    expect(lastCall?.data.get("database.operation")).toBe("findUser");
    expect(lastCall?.data.get("database.entity")).toBe("test");
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
    expect(mockVision.getObserveCalls()).toHaveLength(0);
  });
});

describe("VisionObserve decorator", () => {
  beforeEach(() => {
    mockVision.clear();
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
    await mockVision.observe("test", async () => {
      await repository.findUser(1);
    });

    const lastCall = mockVision.getLastCall();
    expect(lastCall?.name).toBe("db.test.find");
    expect(lastCall?.data.get("database.operation")).toBe("findUser");

    // Test non-instrumented method
    mockVision.clear();
    const result = await repository.regularMethod();
    expect(result).toBe("regular");
    expect(mockVision.getObserveCalls()).toHaveLength(0);
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
    expect(mockVision.getObserveCalls()).toHaveLength(0);
  });
});

describe("VisionEntity decorator", () => {
  beforeEach(() => {
    mockVision.clear();
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
      await mockVision.observe("test", async () => {
        await user.beforeInsert();
      });

      const lastCall = mockVision.getLastCall();
      expect(lastCall?.name).toBe("db.testuser.beforeInsert");
      expect(lastCall?.data.get("database.operation")).toBe("beforeInsert");
      expect(lastCall?.data.get("database.type")).toBe("entity_lifecycle");
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

    expect(mockVision.getObserveCalls()).toHaveLength(0);
  });
});

describe("VisionParam decorator", () => {
  beforeEach(() => {
    mockVision.clear();
    vi.clearAllMocks();
  });

  it("should mark parameters for capture", () => {
    const mockReflect = vi.mocked(require("reflect-metadata").Reflect);
    
    class TestRepository {
      async findUser(
        @VisionParam("userId") id: number,
        @VisionParam("options") options?: any
      ) {
        return { id, name: "Test User" };
      }
    }

    // Verify that metadata was set
    expect(mockReflect.defineMetadata).toHaveBeenCalled();
  });
});