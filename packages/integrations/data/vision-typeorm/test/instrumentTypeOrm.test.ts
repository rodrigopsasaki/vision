import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataSource } from "typeorm";
import { createTestDataSource, TestUser, TestPost, MockVisionContext } from "./setup";

// Mock the vision module with factory function
vi.mock("@rodrigopsasaki/vision", () => ({
  vision: new MockVisionContext(),
}));

import { instrumentDataSource, instrumentRepository } from "../src/instrumentTypeOrm";
import { vision } from "@rodrigopsasaki/vision";

describe("instrumentDataSource", () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    (vision as any).clear();
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

    await (vision as any).observe("test", async () => {
      const repository = instrumentedDataSource.getRepository(TestUser);

      expect(repository).toBeDefined();
      expect(repository.__visionInstrumented).toBe(true);
      expect(repository.__entityName).toBe("TestUser");
    });

    const calls = (vision as any).getObserveCalls();
    const getRepoCall = calls.find((call) => call.name === "db.getRepository");
    expect(getRepoCall).toBeDefined();
    expect(getRepoCall?.data.get("database.operation")).toBe("getRepository");
    expect(getRepoCall?.data.get("database.target")).toBe("typeorm");
  });

  it("should capture connection info when enabled", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource, {
      logConnectionInfo: true,
    });

    await (vision as any).observe("test", async () => {
      instrumentedDataSource.getRepository(TestUser);
    });

    const calls = (vision as any).getObserveCalls();
    const getRepoCall = calls.find((call) => call.name === "db.getRepository");
    expect(getRepoCall?.data.get("database.provider")).toBe("typeorm");
    expect(getRepoCall?.data.get("database.driver")).toBe("sqlite");
  });
});

describe("instrumentRepository", () => {
  let dataSource: DataSource;
  let repository: any;

  beforeEach(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    repository = dataSource.getRepository(TestUser);
    (vision as any).clear();
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

    await (vision as any).observe("test", async () => {
      await instrumentedRepository.save(user);
    });

    const calls = (vision as any).getObserveCalls();
    const saveCall = calls.find((call) => call.name === "db.testuser.save");
    expect(saveCall).toBeDefined();
    expect(saveCall?.data.get("database.operation")).toBe("save");
    expect(saveCall?.data.get("database.target")).toBe("typeorm");
    expect(saveCall?.data.get("database.type")).toBe("repository");
    expect(saveCall?.data.get("database.entity")).toBe("TestUser");
    expect(saveCall?.data.get("database.success")).toBe(true);
    expect(typeof saveCall?.data.get("database.duration_ms")).toBe("number");
  });

  it("should capture find operations with result count", async () => {
    const instrumentedRepository = instrumentRepository(repository);

    // First, save some test data
    await instrumentedRepository.save([
      { name: "John Doe", email: "john@example.com" },
      { name: "Jane Doe", email: "jane@example.com" },
    ]);

    (vision as any).clear();

    await (vision as any).observe("test", async () => {
      await instrumentedRepository.find();
    });

    const calls = (vision as any).getObserveCalls();
    const findCall = calls.find((call) => call.name === "db.testuser.find");
    expect(findCall).toBeDefined();
    expect(findCall?.data.get("database.operation")).toBe("find");
    expect(findCall?.data.get("database.result_count")).toBe(2);
    expect(findCall?.data.get("database.success")).toBe(true);
  });

  it("should capture errors", async () => {
    const instrumentedRepository = instrumentRepository(repository);

    await expect(
      (vision as any).observe("test", async () => {
        // Try to save invalid data to trigger error
        await instrumentedRepository.save({ name: null });
      }),
    ).rejects.toThrow();

    const calls = (vision as any).getObserveCalls();
    const errorCall = calls.find((call) => call.data.get("database.success") === false);
    expect(errorCall).toBeDefined();
    expect(errorCall?.data.get("database.error")).toBeDefined();
    expect(typeof errorCall?.data.get("database.duration_ms")).toBe("number");
  });

  it("should log parameters when enabled", async () => {
    const instrumentedRepository = instrumentRepository(repository, {
      logParams: true,
    });

    const user = { name: "John Doe", email: "john@example.com", password: "secret123" };

    await (vision as any).observe("test", async () => {
      await instrumentedRepository.save(user);
    });

    const calls = (vision as any).getObserveCalls();
    const saveCall = calls.find((call) => call.name === "db.testuser.save");
    const params = saveCall?.data.get("database.params") as any;
    expect(params).toBeDefined();
    expect(params[0].name).toBe("John Doe");
    expect(params[0].password).toBe("[REDACTED]"); // Should be redacted
  });

  it("should not log parameters when disabled", async () => {
    const instrumentedRepository = instrumentRepository(repository, {
      logParams: false,
    });

    const user = { name: "John Doe", email: "john@example.com" };

    await (vision as any).observe("test", async () => {
      await instrumentedRepository.save(user);
    });

    const lastCall = (vision as any).getLastCall();
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
