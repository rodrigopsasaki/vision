import { describe, it, expect } from "vitest";

import type { VisionContext, NormalizationConfig } from "../src/core/types";
import { normalizeContext } from "../src/utils/normalizeContext";

describe("normalizeContext", () => {
  const baseContext: VisionContext = {
    id: "ctx-123",
    timestamp: "2023-01-01T00:00:00.000Z",
    name: "test.operation",
    scope: "http",
    source: "express",
    data: new Map<string, unknown>()
  };

  describe("when normalization is disabled", () => {
    it("should return the original context unchanged", () => {
      const config: NormalizationConfig = {
        enabled: false,
        keyCasing: "snake_case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["userId", "123"],
          ["userProfile", { firstName: "John" }]
        ])
      };

      const result = normalizeContext(context, config);

      expect(result).toBe(context);
      expect(result.data.get("userId")).toBe("123");
      expect(result.data.get("user_id")).toBeUndefined();
    });
  });

  describe("when normalization is enabled", () => {
    it("should normalize context data keys to snake_case", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["userId", "123"],
          ["firstName", "John"],
          ["isActive", true]
        ])
      };

      const result = normalizeContext(context, config);

      expect(result).not.toBe(context);
      expect(result.id).toBe("ctx-123");
      expect(result.name).toBe("test.operation");
      expect(result.data.get("user_id")).toBe("123");
      expect(result.data.get("first_name")).toBe("John");
      expect(result.data.get("is_active")).toBe(true);
      expect(result.data.get("userId")).toBeUndefined();
    });

    it("should normalize context data keys to camelCase", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "camelCase",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["user_id", "123"],
          ["first_name", "John"],
          ["is_active", true]
        ])
      };

      const result = normalizeContext(context, config);

      expect(result.data.get("userId")).toBe("123");
      expect(result.data.get("firstName")).toBe("John");
      expect(result.data.get("isActive")).toBe(true);
      expect(result.data.get("user_id")).toBeUndefined();
    });

    it("should normalize context data keys to kebab-case", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "kebab-case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["userId", "123"],
          ["firstName", "John"]
        ])
      };

      const result = normalizeContext(context, config);

      expect(result.data.get("user-id")).toBe("123");
      expect(result.data.get("first-name")).toBe("John");
    });

    it("should normalize context data keys to PascalCase", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "PascalCase",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["userId", "123"],
          ["firstName", "John"]
        ])
      };

      const result = normalizeContext(context, config);

      expect(result.data.get("UserId")).toBe("123");
      expect(result.data.get("FirstName")).toBe("John");
    });
  });

  describe("deep normalization", () => {
    it("should normalize nested object keys when deep is true", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["userProfile", {
            firstName: "John",
            lastName: "Doe",
            contactInfo: {
              emailAddress: "john@example.com",
              phoneNumber: "555-1234"
            }
          }]
        ])
      };

      const result = normalizeContext(context, config);
      const profile = result.data.get("user_profile") as any;

      expect(profile.first_name).toBe("John");
      expect(profile.last_name).toBe("Doe");
      expect(profile.contact_info.email_address).toBe("john@example.com");
      expect(profile.contact_info.phone_number).toBe("555-1234");
    });

    it("should normalize keys in arrays of objects when deep is true", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["userList", [
            { firstName: "John", lastName: "Doe" },
            { firstName: "Jane", lastName: "Smith" }
          ]]
        ])
      };

      const result = normalizeContext(context, config);
      const userList = result.data.get("user_list") as any[];

      expect(userList[0].first_name).toBe("John");
      expect(userList[0].last_name).toBe("Doe");
      expect(userList[1].first_name).toBe("Jane");
      expect(userList[1].last_name).toBe("Smith");
    });

    it("should not normalize nested object keys when deep is false", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: false
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["userProfile", {
            firstName: "John",
            lastName: "Doe"
          }]
        ])
      };

      const result = normalizeContext(context, config);
      const profile = result.data.get("user_profile") as any;

      // Top-level key should be normalized
      expect(result.data.get("user_profile")).toBeDefined();
      expect(result.data.get("userProfile")).toBeUndefined();

      // Nested keys should NOT be normalized
      expect(profile.firstName).toBe("John");
      expect(profile.lastName).toBe("Doe");
      expect(profile.first_name).toBeUndefined();
      expect(profile.last_name).toBeUndefined();
    });
  });

  describe("complex data structures", () => {
    it("should handle mixed data types correctly", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const testDate = new Date("2023-01-01");
      const testFunction = () => "test";

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["userId", "123"],
          ["isActive", true],
          ["loginCount", 42],
          ["metadata", null],
          ["tagList", ["admin", "user"]],
          ["createdAt", testDate],
          ["processData", testFunction],
          ["emptyObject", {}],
          ["nestedData", {
            stringValue: "test",
            numberValue: 123,
            booleanValue: true,
            nullValue: null,
            arrayValue: [1, 2, 3],
            dateValue: testDate,
            functionValue: testFunction
          }]
        ])
      };

      const result = normalizeContext(context, config);

      // Check top-level transformations
      expect(result.data.get("user_id")).toBe("123");
      expect(result.data.get("is_active")).toBe(true);
      expect(result.data.get("login_count")).toBe(42);
      expect(result.data.get("metadata")).toBe(null);
      expect(result.data.get("tag_list")).toEqual(["admin", "user"]);
      expect(result.data.get("created_at")).toBe(testDate);
      expect(result.data.get("process_data")).toBe(testFunction);
      expect(result.data.get("empty_object")).toEqual({});

      // Check nested data transformations
      const nestedData = result.data.get("nested_data") as any;
      expect(nestedData.string_value).toBe("test");
      expect(nestedData.number_value).toBe(123);
      expect(nestedData.boolean_value).toBe(true);
      expect(nestedData.null_value).toBe(null);
      expect(nestedData.array_value).toEqual([1, 2, 3]);
      expect(nestedData.date_value).toBe(testDate);
      expect(nestedData.function_value).toBe(testFunction);
    });

    it("should preserve the original context metadata", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([["userId", "123"]])
      };

      const result = normalizeContext(context, config);

      expect(result.id).toBe(context.id);
      expect(result.timestamp).toBe(context.timestamp);
      expect(result.name).toBe(context.name);
      expect(result.scope).toBe(context.scope);
      expect(result.source).toBe(context.source);
    });

    it("should create a new context instance", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([["userId", "123"]])
      };

      const result = normalizeContext(context, config);

      expect(result).not.toBe(context);
      expect(result.data).not.toBe(context.data);
    });
  });

  describe("edge cases", () => {
    it("should handle empty data Map", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map()
      };

      const result = normalizeContext(context, config);

      expect(result.data.size).toBe(0);
    });

    it("should handle undefined and null values", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([
          ["undefinedValue", undefined],
          ["nullValue", null]
        ])
      };

      const result = normalizeContext(context, config);

      expect(result.data.get("undefined_value")).toBeUndefined();
      expect(result.data.get("null_value")).toBe(null);
    });

    it("should handle circular references gracefully", () => {
      const config: NormalizationConfig = {
        enabled: true,
        keyCasing: "snake_case",
        deep: true
      };

      const circularObj: any = { userName: "test" };
      circularObj.self = circularObj;

      const context = {
        ...baseContext,
        data: new Map<string, unknown>([["circularData", circularObj]])
      };

      // This should not throw an error
      const result = normalizeContext(context, config);
      const data = result.data.get("circular_data") as any;
      
      expect(data.user_name).toBe("test");
      // The circular reference is preserved but points to the original object
      // to prevent infinite loops during transformation
      expect(data.self).toBe(circularObj);
    });
  });
});