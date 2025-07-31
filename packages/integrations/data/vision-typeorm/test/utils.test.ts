import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  METHOD_CATEGORIES,
  redactSensitiveData,
  truncateQuery,
  extractEntityName,
  categorizeMethod,
  createOperationName,
  extractErrorDetails,
  shouldInstrumentMethod,
  isInternalMethod,
  safeSerializeParams,
} from "../src/utils";

describe("DEFAULT_CONFIG", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_CONFIG.enabled).toBe(true);
    expect(DEFAULT_CONFIG.logParams).toBe(false);
    expect(DEFAULT_CONFIG.logQuery).toBe(true);
    expect(DEFAULT_CONFIG.logResultCount).toBe(true);
    expect(DEFAULT_CONFIG.maxQueryLength).toBe(1000);
    expect(DEFAULT_CONFIG.includeEntityInName).toBe(true);
    expect(DEFAULT_CONFIG.operationPrefix).toBe("db");
    expect(DEFAULT_CONFIG.redactFields).toEqual(["password", "token", "secret", "key", "hash"]);
    expect(DEFAULT_CONFIG.logConnectionInfo).toBe(false);
    expect(DEFAULT_CONFIG.instrumentTransactions).toBe(true);
    expect(DEFAULT_CONFIG.instrumentRepositories).toBe(true);
    expect(DEFAULT_CONFIG.instrumentEntityManager).toBe(true);
  });
});

describe("METHOD_CATEGORIES", () => {
  it("should categorize methods correctly", () => {
    expect(METHOD_CATEGORIES.query).toContain("query");
    expect(METHOD_CATEGORIES.query).toContain("createQueryBuilder");
    expect(METHOD_CATEGORIES.find).toContain("find");
    expect(METHOD_CATEGORIES.find).toContain("findOne");
    expect(METHOD_CATEGORIES.save).toContain("save");
    expect(METHOD_CATEGORIES.save).toContain("insert");
    expect(METHOD_CATEGORIES.remove).toContain("remove");
    expect(METHOD_CATEGORIES.remove).toContain("delete");
  });
});

describe("redactSensitiveData", () => {
  it("should redact sensitive fields", () => {
    const data = {
      username: "john",
      password: "secret123",
      email: "john@example.com",
      apiKey: "key123",
    };

    const redacted = redactSensitiveData(data, ["password", "key"]);

    expect(redacted).toEqual({
      username: "john",
      password: "[REDACTED]",
      email: "john@example.com",
      apiKey: "[REDACTED]",
    });
  });

  it("should handle nested objects", () => {
    const data = {
      user: {
        name: "john",
        credentials: {
          password: "secret123",
          token: "token123",
        },
      },
    };

    const redacted = redactSensitiveData(data, ["password", "token"]);

    expect(redacted).toEqual({
      user: {
        name: "john",
        credentials: {
          password: "[REDACTED]",
          token: "[REDACTED]",
        },
      },
    });
  });

  it("should handle arrays", () => {
    const data = [
      { name: "john", password: "secret1" },
      { name: "jane", password: "secret2" },
    ];

    const redacted = redactSensitiveData(data, ["password"]);

    expect(redacted).toEqual([
      { name: "john", password: "[REDACTED]" },
      { name: "jane", password: "[REDACTED]" },
    ]);
  });

  it("should handle non-objects", () => {
    expect(redactSensitiveData("string", ["password"])).toBe("string");
    expect(redactSensitiveData(123, ["password"])).toBe(123);
    expect(redactSensitiveData(null, ["password"])).toBe(null);
    expect(redactSensitiveData(undefined, ["password"])).toBe(undefined);
  });
});

describe("truncateQuery", () => {
  it("should truncate long queries", () => {
    const longQuery = "SELECT * FROM users WHERE ".repeat(100);
    const truncated = truncateQuery(longQuery, 50);

    expect(truncated).toHaveLength(65); // 50 + "... [truncated]".length
    expect(truncated.endsWith("... [truncated]")).toBe(true);
  });

  it("should not truncate short queries", () => {
    const shortQuery = "SELECT * FROM users";
    const result = truncateQuery(shortQuery, 50);

    expect(result).toBe(shortQuery);
  });
});

describe("extractEntityName", () => {
  it("should extract entity name from repository target", () => {
    function User() {}
    const mockTarget = {
      target: User,
    };

    expect(extractEntityName(mockTarget)).toBe("User");
  });

  it("should extract entity name from string target", () => {
    const mockTarget = {
      target: "User",
    };

    expect(extractEntityName(mockTarget)).toBe("User");
  });

  it("should extract entity name from metadata", () => {
    const mockTarget = {
      metadata: { targetName: "User" },
    };

    expect(extractEntityName(mockTarget)).toBe("User");
  });

  it("should extract entity name from metadata name", () => {
    const mockTarget = {
      metadata: { name: "User" },
    };

    expect(extractEntityName(mockTarget)).toBe("User");
  });

  it("should return undefined for invalid targets", () => {
    expect(extractEntityName(null)).toBeUndefined();
    expect(extractEntityName({})).toBeUndefined();
    expect(extractEntityName("string")).toBeUndefined();
  });
});

describe("categorizeMethod", () => {
  it("should categorize known methods", () => {
    expect(categorizeMethod("find")).toBe("find");
    expect(categorizeMethod("save")).toBe("save");
    expect(categorizeMethod("remove")).toBe("remove");
    expect(categorizeMethod("query")).toBe("query");
    expect(categorizeMethod("transaction")).toBe("transaction");
  });

  it("should return 'operation' for unknown methods", () => {
    expect(categorizeMethod("unknownMethod")).toBe("operation");
  });
});

describe("createOperationName", () => {
  it("should create operation name with entity", () => {
    const name = createOperationName("find", "User", DEFAULT_CONFIG);
    expect(name).toBe("db.user.find");
  });

  it("should create operation name without entity", () => {
    const name = createOperationName("transaction", undefined, DEFAULT_CONFIG);
    expect(name).toBe("db.transaction");
  });

  it("should respect includeEntityInName config", () => {
    const config = { ...DEFAULT_CONFIG, includeEntityInName: false };
    const name = createOperationName("find", "User", config);
    expect(name).toBe("db.find");
  });

  it("should use custom prefix", () => {
    const config = { ...DEFAULT_CONFIG, operationPrefix: "database" };
    const name = createOperationName("find", "User", config);
    expect(name).toBe("database.user.find");
  });
});

describe("extractErrorDetails", () => {
  it("should extract TypeORM error details", () => {
    const error = {
      code: "ER_DUP_ENTRY",
      sqlState: "23000",
      query: "INSERT INTO users...",
      parameters: ["john", "john@example.com"],
      constraint: "users_email_unique",
    };

    const details = extractErrorDetails(error);

    expect(details.code).toBe("ER_DUP_ENTRY");
    expect(details.sqlState).toBe("23000");
    expect(details.query).toBe("INSERT INTO users...");
    expect(details.parameters).toEqual(["john", "john@example.com"]);
    expect(details.constraint).toBe("users_email_unique");
  });

  it("should handle errors without details", () => {
    const details = extractErrorDetails(new Error("Generic error"));
    expect(details).toEqual({});
  });

  it("should handle non-object errors", () => {
    expect(extractErrorDetails("string error")).toEqual({});
    expect(extractErrorDetails(null)).toEqual({});
  });
});

describe("shouldInstrumentMethod", () => {
  it("should respect enabled config", () => {
    const disabledConfig = { ...DEFAULT_CONFIG, enabled: false };
    expect(shouldInstrumentMethod("find", "repository", disabledConfig)).toBe(false);
  });

  it("should respect component-specific config", () => {
    const config = { ...DEFAULT_CONFIG, instrumentRepositories: false };
    expect(shouldInstrumentMethod("find", "repository", config)).toBe(false);
    expect(shouldInstrumentMethod("query", "datasource", config)).toBe(true);
  });

  it("should always instrument core components", () => {
    expect(shouldInstrumentMethod("query", "datasource", DEFAULT_CONFIG)).toBe(true);
    expect(shouldInstrumentMethod("query", "queryrunner", DEFAULT_CONFIG)).toBe(true);
  });
});

describe("isInternalMethod", () => {
  it("should identify internal methods", () => {
    expect(isInternalMethod("_private")).toBe(true);
    expect(isInternalMethod("$internal")).toBe(true);
    expect(isInternalMethod("constructor")).toBe(true);
    expect(isInternalMethod("toString")).toBe(true);
    expect(isInternalMethod("hasOwnProperty")).toBe(true);
  });

  it("should not identify public methods as internal", () => {
    expect(isInternalMethod("find")).toBe(false);
    expect(isInternalMethod("save")).toBe(false);
    expect(isInternalMethod("customMethod")).toBe(false);
  });
});

describe("safeSerializeParams", () => {
  it("should serialize simple objects", () => {
    const params = { name: "john", age: 30 };
    const serialized = safeSerializeParams(params);

    expect(serialized).toEqual({ name: "john", age: 30 });
  });

  it("should handle special types", () => {
    const params = {
      func: function() {},
      sym: Symbol("test"),
      big: BigInt(123),
      date: new Date("2023-01-01"),
      regex: /test/g,
    };

    const serialized = safeSerializeParams(params);

    expect(serialized).toEqual({
      func: "[Function]",
      sym: "[Symbol]",
      big: "123n",
      date: "2023-01-01T00:00:00.000Z",
      regex: "/test/g",
    });
  });

  it("should handle circular references", () => {
    const obj: any = { name: "test" };
    obj.self = obj; // Create circular reference

    const serialized = safeSerializeParams(obj);
    expect(serialized).toBe("[Circular or Non-Serializable]");
  });
});