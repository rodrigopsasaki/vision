import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataSource } from "typeorm";
import { instrumentDataSource, instrumentRepository } from "../src/instrumentTypeOrm";
import { createTestDataSource, TestUser, TestPost, MockVisionContext } from "./setup";

// Create mock vision instance
const mockVision = new MockVisionContext();

// Mock the vision module
vi.mock("@rodrigopsasaki/vision", () => ({
  vision: mockVision,
}));

describe("instrumentDataSource", () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    mockVision.clear();
  });

  afterEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it("should instrument DataSource methods", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource);

    expect(instrumentedDataSource).toBeDefined();
    expect(instrumentedDataSource.__visionInstrumented).toBe(true);
  });

  it("should not double-instrument a DataSource", async () => {
    const instrumentedDataSource1 = instrumentDataSource(dataSource);
    const instrumentedDataSource2 = instrumentDataSource(instrumentedDataSource1);

    expect(instrumentedDataSource1).toBe(instrumentedDataSource2);
  });

  it("should return original DataSource when disabled", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource, { enabled: false });

    expect(instrumentedDataSource).toBe(dataSource);
    expect(instrumentedDataSource.__visionInstrumented).toBeUndefined();
  });

  it("should instrument repository retrieval", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource);

    await mockVision.observe("test", async () => {
      const repository = instrumentedDataSource.getRepository(TestUser);

      expect(repository).toBeDefined();
      expect(repository.__visionInstrumented).toBe(true);
      expect(repository.__entityName).toBe("TestUser");
    });

    const lastCall = mockVision.getLastCall();
    expect(lastCall?.name).toBe("db.operation");
    expect(lastCall?.data.get("database.operation")).toBe("getRepository");
    expect(lastCall?.data.get("database.target")).toBe("typeorm");
  });

  it("should capture connection info when enabled", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource, {
      logConnectionInfo: true,
    });

    await mockVision.observe("test", async () => {
      instrumentedDataSource.getRepository(TestUser);
    });

    const lastCall = mockVision.getLastCall();
    expect(lastCall?.data.get("database.provider")).toBe("typeorm");
    expect(lastCall?.data.get("database.driver")).toBe("sqlite");
  });
});

describe("instrumentRepository", () => {
  let dataSource: DataSource;
  let repository: any;

  beforeEach(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    repository = dataSource.getRepository(TestUser);
    mockVision.clear();
  });

  afterEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it("should instrument Repository methods", async () => {
    const instrumentedRepository = instrumentRepository(repository);

    expect(instrumentedRepository).toBeDefined();
    expect(instrumentedRepository.__visionInstrumented).toBe(true);
    expect(instrumentedRepository.__entityName).toBe("TestUser");
  });

  it("should capture save operations", async () => {
    const instrumentedRepository = instrumentRepository(repository);

    const user = { name: "John Doe", email: "john@example.com" };

    await mockVision.observe("test", async () => {
      await instrumentedRepository.save(user);
    });

    const lastCall = mockVision.getLastCall();
    expect(lastCall?.name).toBe("db.testuser.save");
    expect(lastCall?.data.get("database.operation")).toBe("save");
    expect(lastCall?.data.get("database.target")).toBe("typeorm");
    expect(lastCall?.data.get("database.type")).toBe("repository");
    expect(lastCall?.data.get("database.entity")).toBe("TestUser");
    expect(lastCall?.data.get("database.success")).toBe(true);
    expect(typeof lastCall?.data.get("database.duration_ms")).toBe("number");
  });

  it("should capture find operations with result count", async () => {
    const instrumentedRepository = instrumentRepository(repository);

    // First, save some test data
    await instrumentedRepository.save([
      { name: "John Doe", email: "john@example.com" },
      { name: "Jane Doe", email: "jane@example.com" },
    ]);

    mockVision.clear();

    await mockVision.observe("test", async () => {
      await instrumentedRepository.find();
    });

    const lastCall = mockVision.getLastCall();
    expect(lastCall?.name).toBe("db.testuser.find");
    expect(lastCall?.data.get("database.operation")).toBe("find");
    expect(lastCall?.data.get("database.result_count")).toBe(2);
    expect(lastCall?.data.get("database.success")).toBe(true);
  });

  it("should capture errors", async () => {
    const instrumentedRepository = instrumentRepository(repository);

    await expect(
      mockVision.observe("test", async () => {
        // Try to save invalid data to trigger error
        await instrumentedRepository.save({ name: null });
      }),
    ).rejects.toThrow();

    const lastCall = mockVision.getLastCall();
    expect(lastCall?.data.get("database.success")).toBe(false);
    expect(lastCall?.data.get("database.error")).toBeDefined();
    expect(typeof lastCall?.data.get("database.duration_ms")).toBe("number");
  });

  it("should log parameters when enabled", async () => {
    const instrumentedRepository = instrumentRepository(repository, {
      logParams: true,
    });

    const user = { name: "John Doe", email: "john@example.com", password: "secret123" };

    await mockVision.observe("test", async () => {
      await instrumentedRepository.save(user);
    });

    const lastCall = mockVision.getLastCall();
    const params = lastCall?.data.get("database.params") as any;
    expect(params).toBeDefined();
    expect(params[0].name).toBe("John Doe");
    expect(params[0].password).toBe("[REDACTED]"); // Should be redacted
  });

  it("should not log parameters when disabled", async () => {
    const instrumentedRepository = instrumentRepository(repository, {
      logParams: false,
    });

    const user = { name: "John Doe", email: "john@example.com" };

    await mockVision.observe("test", async () => {
      await instrumentedRepository.save(user);
    });

    const lastCall = mockVision.getLastCall();
    expect(lastCall?.data.get("database.params")).toBeUndefined();
  });

  it("should work with disabled instrumentation", async () => {
    const instrumentedRepository = instrumentRepository(repository, {
      enabled: false,
    });

    expect(instrumentedRepository).toBe(repository);
    expect(instrumentedRepository.__visionInstrumented).toBeUndefined();
  });
});
