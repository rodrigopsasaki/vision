import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataSource } from "typeorm";
import { 
  instrumentDataSource, 
  visionTransaction, 
  VisionInstrumented,
  VisionObserve,
} from "../src/index";
import { createTestDataSource, TestUser, TestPost, MockVisionContext } from "./setup";

// Create mock vision instance
const mockVision = new MockVisionContext();

// Mock the vision module
vi.mock("@rodrigopsasaki/vision", () => ({
  vision: mockVision,
}));

describe("Integration Tests", () => {
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

  it("should provide complete end-to-end observability", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource, {
      logParams: true,
      logQuery: true,
      logResultCount: true,
      logConnectionInfo: true,
    });

    const result = await visionTransaction(instrumentedDataSource, async (manager) => {
      // Create a user
      const userRepository = manager.getRepository(TestUser);
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
        password: "secret123"
      });

      // Create posts for the user
      const postRepository = manager.getRepository(TestPost);
      const post1 = await postRepository.save({
        title: "First Post",
        content: "This is my first post",
        userId: user.id,
      });

      const post2 = await postRepository.save({
        title: "Second Post", 
        content: "This is my second post",
        userId: user.id,
      });

      // Find all posts by user
      const userPosts = await postRepository.find({
        where: { userId: user.id }
      });

      // Find user with count
      const totalUsers = await userRepository.count();

      return {
        user,
        posts: [post1, post2],
        userPosts,
        totalUsers,
      };
    });

    // Verify the transaction worked
    expect(result.user.name).toBe("John Doe");
    expect(result.posts).toHaveLength(2);
    expect(result.userPosts).toHaveLength(2);
    expect(result.totalUsers).toBe(1);

    // Verify Vision captured the transaction
    const calls = mockVision.getObserveCalls();
    const transactionCall = calls.find(call => call.name === "db.transaction");
    
    expect(transactionCall).toBeDefined();
    expect(transactionCall?.data.get("database.operation")).toBe("transaction");
    expect(transactionCall?.data.get("database.success")).toBe(true);
    expect(typeof transactionCall?.data.get("database.query_count")).toBe("number");

    // Verify individual repository operations were captured
    const saveUserCall = calls.find(call => call.name === "db.testuser.save");
    expect(saveUserCall).toBeDefined();
    expect(saveUserCall?.data.get("database.entity")).toBe("TestUser");

    const savePostCalls = calls.filter(call => call.name === "db.testpost.save");
    expect(savePostCalls).toHaveLength(2);

    const findPostsCall = calls.find(call => call.name === "db.testpost.find");
    expect(findPostsCall).toBeDefined();
    expect(findPostsCall?.data.get("database.result_count")).toBe(2);

    const countUsersCall = calls.find(call => call.name === "db.testuser.find");
    expect(countUsersCall).toBeDefined();

    // Verify sensitive data was redacted
    const userSaveCall = calls.find(call => 
      call.name === "db.testuser.save" && 
      call.data.get("database.params")
    );
    if (userSaveCall) {
      const params = userSaveCall.data.get("database.params") as any;
      expect(params[0].password).toBe("[REDACTED]");
      expect(params[0].name).toBe("John Doe"); // Non-sensitive data should remain
    }
  });

  it("should handle errors gracefully with full context", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource);

    await expect(
      visionTransaction(instrumentedDataSource, async (manager) => {
        const userRepository = manager.getRepository(TestUser);
        
        // This should work
        await userRepository.save({
          name: "Valid User",
          email: "valid@example.com",
        });

        // This should fail due to constraint violation (if we had unique constraints)
        // For this test, we'll just throw a manual error
        throw new Error("Simulated database error");
      })
    ).rejects.toThrow("Simulated database error");

    // Verify error was captured in transaction
    const calls = mockVision.getObserveCalls();
    const transactionCall = calls.find(call => call.name === "db.transaction");
    
    expect(transactionCall).toBeDefined();
    expect(transactionCall?.data.get("database.success")).toBe(false);
    expect(transactionCall?.data.get("database.error")).toBe("Simulated database error");
    
    // But the successful save should still be captured
    const saveCall = calls.find(call => call.name === "db.testuser.save");
    expect(saveCall).toBeDefined();
    expect(saveCall?.data.get("database.success")).toBe(true);
  });

  it("should work with decorator-based instrumentation", async () => {
    @VisionInstrumented({ logParams: true })
    class UserService {
      constructor(private userRepository: any) {}

      async createUser(userData: { name: string; email: string }) {
        return await this.userRepository.save(userData);
      }

      @VisionObserve()
      async findUserByEmail(email: string) {
        return await this.userRepository.findOne({ where: { email } });
      }

      // This method should not be instrumented by VisionInstrumented
      // because it's not instrumented by the decorator
      async regularMethod() {
        return "not instrumented";
      }
    }

    const instrumentedDataSource = instrumentDataSource(dataSource);
    const userRepository = instrumentedDataSource.getRepository(TestUser);
    const userService = new UserService(userRepository);

    // Test the instrumented methods
    await mockVision.observe("test", async () => {
      const user = await userService.createUser({
        name: "Service User",
        email: "service@example.com",
      });

      const foundUser = await userService.findUserByEmail("service@example.com");
      
      expect(user).toBeDefined();
      expect(foundUser).toBeDefined();
      expect(foundUser?.email).toBe("service@example.com");
    });

    // Check that decorator instrumentation worked
    const calls = mockVision.getObserveCalls();
    const createUserCall = calls.find(call => call.name === "db.userservice.operation");
    expect(createUserCall).toBeDefined();

    const findUserCall = calls.find(call => call.name === "db.userservice.operation");
    expect(findUserCall).toBeDefined();

    // Test non-instrumented method
    const result = await userService.regularMethod();
    expect(result).toBe("not instrumented");
  });

  it("should handle complex query operations", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource, {
      logQuery: true,
      logParams: true,
    });

    await mockVision.observe("complex-queries", async () => {
      const userRepository = instrumentedDataSource.getRepository(TestUser);
      
      // Save some test data first
      await userRepository.save([
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
        { name: "Charlie", email: "charlie@example.com" },
      ]);

      // Perform complex queries
      const queryBuilder = userRepository.createQueryBuilder("user");
      const users = await queryBuilder
        .where("user.name LIKE :pattern", { pattern: "%a%" })
        .orderBy("user.name", "ASC")
        .getMany();

      expect(users).toHaveLength(2); // Alice and Charlie

      // Test count query
      const count = await userRepository.count();
      expect(count).toBe(3);

      // Test findAndCount
      const [foundUsers, totalCount] = await userRepository.findAndCount({
        order: { name: "ASC" }
      });
      
      expect(foundUsers).toHaveLength(3);
      expect(totalCount).toBe(3);
    });

    const calls = mockVision.getObserveCalls();
    
    // Should have captured the bulk save
    const saveCall = calls.find(call => call.name === "db.testuser.save");
    expect(saveCall).toBeDefined();

    // Should have captured the query builder operation
    const queryBuilderCall = calls.find(call => 
      call.name === "db.testuser.query" || 
      call.name === "db.testuser.operation"
    );
    expect(queryBuilderCall).toBeDefined();

    // Should have captured count operations
    const countCalls = calls.filter(call => 
      call.name === "db.testuser.find" ||
      call.name === "db.testuser.operation"
    );
    expect(countCalls.length).toBeGreaterThan(0);
  });

  it("should provide proper error context for database constraint violations", async () => {
    const instrumentedDataSource = instrumentDataSource(dataSource);

    await expect(
      mockVision.observe("constraint-test", async () => {
        const userRepository = instrumentedDataSource.getRepository(TestUser);
        
        // Try to save invalid data that would trigger a database error
        // Note: This is a simplified test - in real scenarios you'd have actual constraints
        await userRepository.save({
          name: null as any, // This should cause a NOT NULL constraint error
          email: "test@example.com",
        });
      })
    ).rejects.toThrow();

    const calls = mockVision.getObserveCalls();
    const errorCall = calls.find(call => 
      call.data.get("database.success") === false
    );

    expect(errorCall).toBeDefined();
    expect(errorCall?.data.get("database.error")).toBeDefined();
    expect(typeof errorCall?.data.get("database.duration_ms")).toBe("number");
  });
});