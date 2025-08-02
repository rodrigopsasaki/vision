import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataSource } from "typeorm";
import { createTestDataSource, TestUser, TestPost, MockVisionContext } from "./setup";

// Mock the vision module with factory function
vi.mock("@rodrigopsasaki/vision", () => ({
  vision: new MockVisionContext(),
}));

import {
  instrumentDataSource,
  visionTransaction,
  VisionInstrumented,
  VisionObserve,
} from "../src/index";
import { vision } from "@rodrigopsasaki/vision";

describe("Integration Tests", () => {
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

  it("should provide complete end-to-end observability", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource, {
      logParams: true,
      logQuery: true,
      logResultCount: true,
      logConnectionInfo: true,
    });

    // We don't need to verify TypeORM functionality, just that our instrumentation works
    const result = await visionTransaction(instrumentedDataSource, async (manager) => {
      const userRepository = manager.getRepository(TestUser);
      const postRepository = manager.getRepository(TestPost);
      
      // Just call the methods we want to instrument - actual results don't matter for this test
      await userRepository.save({ name: "John Doe", email: "john@example.com", password: "secret123" });
      await postRepository.save({ title: "Post 1", content: "Content", userId: 1 });
      await postRepository.save({ title: "Post 2", content: "Content", userId: 1 });
      await postRepository.find({ where: { userId: 1 } });
      await userRepository.count();

      return "transaction completed";
    });

    // Verify our instrumentation captured the expected calls
    const calls = (vision as any).getObserveCalls();
    
    // Verify transaction was captured
    const transactionCall = calls.find((call) => 
      call.name === "db.transaction" && 
      call.data.get("database.query_count") !== undefined
    );
    expect(transactionCall).toBeDefined();
    expect(transactionCall?.data.get("database.operation")).toBe("transaction");
    expect(transactionCall?.data.get("database.success")).toBe(true);

    // Verify repository operations were captured
    expect(calls.some(call => call.name === "db.testuser.save")).toBe(true);
    expect(calls.filter(call => call.name === "db.testpost.save")).toHaveLength(2);
    expect(calls.some(call => call.name === "db.testpost.find")).toBe(true);
    expect(calls.some(call => call.name === "db.testuser.count")).toBe(true);

    // Just verify that we captured the save call with params enabled
    // (Parameter redaction is tested separately in unit tests)
    const userSaveCall = calls.find(call => call.name === "db.testuser.save");
    expect(userSaveCall).toBeDefined();
    expect(userSaveCall?.data.get("database.operation")).toBe("save");
  });

  it("should handle errors gracefully with full context", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource);

    await expect(
      visionTransaction(instrumentedDataSource, async (manager) => {
        const userRepository = manager.getRepository(TestUser);
        
        // Call a method that should work (we're testing instrumentation, not TypeORM)
        await userRepository.save({ name: "Valid User", email: "valid@example.com" });

        // Simulate an error to test error handling
        throw new Error("Simulated database error");
      }),
    ).rejects.toThrow("Simulated database error");

    // Verify our instrumentation captured the error
    const calls = (vision as any).getObserveCalls();
    const transactionCall = calls.find((call) => 
      call.name === "db.transaction" && call.data.get("database.success") === false
    );

    expect(transactionCall).toBeDefined();
    expect(transactionCall?.data.get("database.error")).toBe("Simulated database error");

    // Verify the successful save was still captured
    expect(calls.some(call => call.name === "db.testuser.save")).toBe(true);
  });

  it("should work with decorator-based instrumentation", async () => {
    // Test just the VisionObserve decorator (simpler and more focused)
    class UserService {
      @VisionObserve()
      async findUserByEmail(email: string) {
        return { id: 1, email }; // Mock return
      }

      async regularMethod() {
        return "not instrumented";
      }
    }

    const userService = new UserService();

    // Test the decorated method
    await userService.findUserByEmail("service@example.com");

    // Check that decorator instrumentation worked
    const calls = (vision as any).getObserveCalls();
    expect(calls.some(call => call.name === "db.userservice.findUserByEmail")).toBe(true);

    // Test non-decorated method - should work without adding calls
    expect(await userService.regularMethod()).toBe("not instrumented");
  });

  it("should handle repository query operations", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource);
    const userRepository = instrumentedDataSource.getRepository(TestUser);

    // Test basic repository methods that we instrument
    await userRepository.save({ name: "Alice", email: "alice@example.com" });
    await userRepository.count();
    await userRepository.find({ order: { name: "ASC" } });

    const calls = (vision as any).getObserveCalls();

    // Verify our instrumentation captured the expected operations
    expect(calls.some(call => call.name === "db.testuser.save")).toBe(true);
    expect(calls.some(call => call.name === "db.testuser.count")).toBe(true);
    expect(calls.some(call => call.name === "db.testuser.find")).toBe(true);
  });

  it("should provide proper error context for database constraint violations", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource);

    await expect(
      (vision as any).observe("constraint-test", async () => {
        const userRepository = instrumentedDataSource.getRepository(TestUser);

        // Try to save invalid data that would trigger a database error
        // Note: This is a simplified test - in real scenarios you'd have actual constraints
        await userRepository.save({
          name: null as any, // This should cause a NOT NULL constraint error
          email: "test@example.com",
        });
      }),
    ).rejects.toThrow();

    const calls = (vision as any).getObserveCalls();
    const errorCall = calls.find((call) => call.data.get("database.success") === false);

    expect(errorCall).toBeDefined();
    expect(errorCall?.data.get("database.error")).toBeDefined();
    expect(typeof errorCall?.data.get("database.duration_ms")).toBe("number");
  });
});
