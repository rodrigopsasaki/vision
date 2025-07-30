import { describe, it, expect } from "vitest";

import { 
  transformKey, 
  transformObjectKeys, 
  transformMapKeys,
  type CasingStyle 
} from "../src/utils/keyTransforms";

describe("transformKey", () => {
  describe("camelCase transformation", () => {
    it("should convert snake_case to camelCase", () => {
      expect(transformKey("user_id", "camelCase")).toBe("userId");
      expect(transformKey("first_name", "camelCase")).toBe("firstName");
      expect(transformKey("api_key_secret", "camelCase")).toBe("apiKeySecret");
    });

    it("should convert kebab-case to camelCase", () => {
      expect(transformKey("user-id", "camelCase")).toBe("userId");
      expect(transformKey("first-name", "camelCase")).toBe("firstName");
      expect(transformKey("api-key-secret", "camelCase")).toBe("apiKeySecret");
    });

    it("should convert PascalCase to camelCase", () => {
      expect(transformKey("UserId", "camelCase")).toBe("userId");
      expect(transformKey("FirstName", "camelCase")).toBe("firstName");
      expect(transformKey("APIKeySecret", "camelCase")).toBe("aPIKeySecret");
    });

    it("should handle already camelCase strings", () => {
      expect(transformKey("userId", "camelCase")).toBe("userId");
      expect(transformKey("firstName", "camelCase")).toBe("firstName");
    });

    it("should handle single words", () => {
      expect(transformKey("user", "camelCase")).toBe("user");
      expect(transformKey("id", "camelCase")).toBe("id");
    });
  });

  describe("snake_case transformation", () => {
    it("should convert camelCase to snake_case", () => {
      expect(transformKey("userId", "snake_case")).toBe("user_id");
      expect(transformKey("firstName", "snake_case")).toBe("first_name");
      expect(transformKey("apiKeySecret", "snake_case")).toBe("api_key_secret");
    });

    it("should convert kebab-case to snake_case", () => {
      expect(transformKey("user-id", "snake_case")).toBe("user_id");
      expect(transformKey("first-name", "snake_case")).toBe("first_name");
    });

    it("should convert PascalCase to snake_case", () => {
      expect(transformKey("UserId", "snake_case")).toBe("user_id");
      expect(transformKey("FirstName", "snake_case")).toBe("first_name");
      expect(transformKey("XMLHttpRequest", "snake_case")).toBe("x_m_l_http_request");
    });

    it("should handle already snake_case strings", () => {
      expect(transformKey("user_id", "snake_case")).toBe("user_id");
      expect(transformKey("first_name", "snake_case")).toBe("first_name");
    });
  });

  describe("kebab-case transformation", () => {
    it("should convert camelCase to kebab-case", () => {
      expect(transformKey("userId", "kebab-case")).toBe("user-id");
      expect(transformKey("firstName", "kebab-case")).toBe("first-name");
    });

    it("should convert snake_case to kebab-case", () => {
      expect(transformKey("user_id", "kebab-case")).toBe("user-id");
      expect(transformKey("first_name", "kebab-case")).toBe("first-name");
    });

    it("should convert PascalCase to kebab-case", () => {
      expect(transformKey("UserId", "kebab-case")).toBe("user-id");
      expect(transformKey("FirstName", "kebab-case")).toBe("first-name");
    });
  });

  describe("PascalCase transformation", () => {
    it("should convert camelCase to PascalCase", () => {
      expect(transformKey("userId", "PascalCase")).toBe("UserId");
      expect(transformKey("firstName", "PascalCase")).toBe("FirstName");
    });

    it("should convert snake_case to PascalCase", () => {
      expect(transformKey("user_id", "PascalCase")).toBe("UserId");
      expect(transformKey("first_name", "PascalCase")).toBe("FirstName");
    });

    it("should convert kebab-case to PascalCase", () => {
      expect(transformKey("user-id", "PascalCase")).toBe("UserId");
      expect(transformKey("first-name", "PascalCase")).toBe("FirstName");
    });
  });

  describe("none transformation", () => {
    it("should return the key unchanged", () => {
      expect(transformKey("userId", "none")).toBe("userId");
      expect(transformKey("user_id", "none")).toBe("user_id");
      expect(transformKey("user-id", "none")).toBe("user-id");
      expect(transformKey("UserId", "none")).toBe("UserId");
    });
  });

  describe("edge cases", () => {
    it("should handle empty strings", () => {
      const styles: CasingStyle[] = ["camelCase", "snake_case", "kebab-case", "PascalCase", "none"];
      for (const style of styles) {
        expect(transformKey("", style)).toBe("");
      }
    });

    it("should handle single characters", () => {
      expect(transformKey("a", "camelCase")).toBe("a");
      expect(transformKey("A", "camelCase")).toBe("a");
      expect(transformKey("a", "PascalCase")).toBe("A");
    });

    it("should handle mixed delimiters", () => {
      expect(transformKey("user_id-name", "camelCase")).toBe("userIdName");
      expect(transformKey("user_id-name", "snake_case")).toBe("user_id_name");
    });

    it("should handle consecutive uppercase letters", () => {
      expect(transformKey("XMLHttpRequest", "snake_case")).toBe("x_m_l_http_request");
      expect(transformKey("HTTPSConnection", "camelCase")).toBe("hTTPSConnection");
    });
  });
});

describe("transformObjectKeys", () => {
  it("should transform keys in flat objects", () => {
    const input = {
      userId: "123",
      firstName: "John",
      lastLoginAt: "2023-01-01"
    };

    const expected = {
      user_id: "123",
      first_name: "John",
      last_login_at: "2023-01-01"
    };

    expect(transformObjectKeys(input, "snake_case")).toEqual(expected);
  });

  it("should transform keys in nested objects", () => {
    const input = {
      userId: "123",
      userProfile: {
        firstName: "John",
        lastName: "Doe",
        contactInfo: {
          emailAddress: "john@example.com",
          phoneNumber: "555-1234"
        }
      }
    };

    const expected = {
      user_id: "123",
      user_profile: {
        first_name: "John",
        last_name: "Doe",
        contact_info: {
          email_address: "john@example.com",
          phone_number: "555-1234"
        }
      }
    };

    expect(transformObjectKeys(input, "snake_case")).toEqual(expected);
  });

  it("should transform keys in arrays of objects", () => {
    const input = {
      userList: [
        { firstName: "John", lastName: "Doe" },
        { firstName: "Jane", lastName: "Smith" }
      ]
    };

    const expected = {
      user_list: [
        { first_name: "John", last_name: "Doe" },
        { first_name: "Jane", last_name: "Smith" }
      ]
    };

    expect(transformObjectKeys(input, "snake_case")).toEqual(expected);
  });

  it("should handle mixed data types", () => {
    const input = {
      userId: "123",
      isActive: true,
      loginCount: 42,
      metadata: null,
      tags: ["admin", "user"],
      createdAt: new Date("2023-01-01"),
      processData: () => "test"
    };

    const result = transformObjectKeys(input, "snake_case") as any;

    expect(result.user_id).toBe("123");
    expect(result.is_active).toBe(true);
    expect(result.login_count).toBe(42);
    expect(result.metadata).toBe(null);
    expect(result.tags).toEqual(["admin", "user"]);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(typeof result.process_data).toBe("function");
  });

  it("should handle primitives without transformation", () => {
    expect(transformObjectKeys("string", "snake_case")).toBe("string");
    expect(transformObjectKeys(123, "snake_case")).toBe(123);
    expect(transformObjectKeys(true, "snake_case")).toBe(true);
    expect(transformObjectKeys(null, "snake_case")).toBe(null);
    expect(transformObjectKeys(undefined, "snake_case")).toBe(undefined);
  });

  it("should not transform when style is 'none'", () => {
    const input = {
      userId: "123",
      userProfile: { firstName: "John" }
    };

    expect(transformObjectKeys(input, "none")).toEqual(input);
  });
});

describe("transformMapKeys", () => {
  it("should transform Map keys", () => {
    const input = new Map<string, unknown>([
      ["userId", "123"],
      ["firstName", "John"],
      ["userProfile", { lastName: "Doe" }]
    ]);

    const result = transformMapKeys(input, "snake_case");

    expect(result.get("user_id")).toBe("123");
    expect(result.get("first_name")).toBe("John");
    expect(result.get("user_profile")).toEqual({ last_name: "Doe" });
    expect(result.get("userId")).toBeUndefined();
  });

  it("should transform values recursively", () => {
    const input = new Map<string, unknown>([
      ["userProfile", {
        firstName: "John",
        contactDetails: {
          emailAddress: "john@example.com"
        }
      }]
    ]);

    const result = transformMapKeys(input, "snake_case");
    const profile = result.get("user_profile") as any;

    expect(profile.first_name).toBe("John");
    expect(profile.contact_details.email_address).toBe("john@example.com");
  });

  it("should not transform when style is 'none'", () => {
    const input = new Map<string, unknown>([["userId", "123"]]);
    const result = transformMapKeys(input, "none");

    expect(result).toBe(input);
    expect(result.get("userId")).toBe("123");
  });

  it("should handle empty Maps", () => {
    const input = new Map<string, unknown>();
    const result = transformMapKeys(input, "snake_case");

    expect(result.size).toBe(0);
  });
});