import { describe, it, expect, beforeEach } from "vitest";

import type { VisionExporter, VisionContext } from "../src/core/types";
import { vision } from "../src/core/vision";

describe("Normalization Integration", () => {
  let capturedContexts: VisionContext[] = [];

  const testExporter: VisionExporter = {
    name: "test-exporter",
    success: (ctx) => {
      capturedContexts.push(ctx);
    },
    error: (ctx) => {
      capturedContexts.push(ctx);
    },
  };

  beforeEach(() => {
    capturedContexts = [];

    // Reset vision runtime to clean state
    vision.init({
      exporters: [testExporter],
      normalization: {
        enabled: false,
        keyCasing: "none",
        deep: true,
      },
    });
  });

  describe("when normalization is disabled", () => {
    it("should not transform keys", async () => {
      vision.init({
        exporters: [testExporter],
        normalization: {
          enabled: false,
          keyCasing: "snake_case",
          deep: true,
        },
      });

      await vision.observe("test.operation", async () => {
        vision.set("userId", "123");
        vision.set("firstName", "John");
        vision.merge("userProfile", {
          lastName: "Doe",
          contactInfo: { emailAddress: "john@example.com" },
        });
      });

      expect(capturedContexts).toHaveLength(1);
      const context = capturedContexts[0];

      expect(context.data.get("userId")).toBe("123");
      expect(context.data.get("firstName")).toBe("John");
      expect(context.data.get("user_id")).toBeUndefined();
      expect(context.data.get("first_name")).toBeUndefined();

      const profile = context.data.get("userProfile") as any;
      expect(profile.lastName).toBe("Doe");
      expect(profile.contactInfo.emailAddress).toBe("john@example.com");
    });
  });

  describe("when normalization is enabled with snake_case", () => {
    beforeEach(() => {
      vision.init({
        exporters: [testExporter],
        normalization: {
          enabled: true,
          keyCasing: "snake_case",
          deep: true,
        },
      });
    });

    it("should transform all keys to snake_case", async () => {
      await vision.observe("test.operation", async () => {
        vision.set("userId", "123");
        vision.set("firstName", "John");
        vision.set("isActive", true);
      });

      expect(capturedContexts).toHaveLength(1);
      const context = capturedContexts[0];

      expect(context.data.get("user_id")).toBe("123");
      expect(context.data.get("first_name")).toBe("John");
      expect(context.data.get("is_active")).toBe(true);

      // Original keys should not exist
      expect(context.data.get("userId")).toBeUndefined();
      expect(context.data.get("firstName")).toBeUndefined();
      expect(context.data.get("isActive")).toBeUndefined();
    });

    it("should transform nested object keys", async () => {
      await vision.observe("test.operation", async () => {
        vision.set("userProfile", {
          firstName: "John",
          lastName: "Doe",
          personalInfo: {
            birthDate: "1990-01-01",
            phoneNumber: "555-1234",
          },
        });
      });

      const context = capturedContexts[0];
      const profile = context.data.get("user_profile") as any;

      expect(profile.first_name).toBe("John");
      expect(profile.last_name).toBe("Doe");
      expect(profile.personal_info.birth_date).toBe("1990-01-01");
      expect(profile.personal_info.phone_number).toBe("555-1234");
    });

    it("should transform keys in arrays", async () => {
      await vision.observe("test.operation", async () => {
        vision.push("eventList", { eventType: "login", timeStamp: "2023-01-01" });
        vision.push("eventList", { eventType: "logout", timeStamp: "2023-01-02" });
      });

      const context = capturedContexts[0];
      const events = context.data.get("event_list") as any[];

      expect(events).toHaveLength(2);
      expect(events[0].event_type).toBe("login");
      expect(events[0].time_stamp).toBe("2023-01-01");
      expect(events[1].event_type).toBe("logout");
      expect(events[1].time_stamp).toBe("2023-01-02");
    });

    it("should work with merge operations", async () => {
      await vision.observe("test.operation", async () => {
        vision.merge("requestData", {
          httpMethod: "POST",
          requestPath: "/api/users",
        });
        vision.merge("requestData", {
          responseCode: 200,
          processingTime: 150,
        });
      });

      const context = capturedContexts[0];
      const requestData = context.data.get("request_data") as any;

      expect(requestData.http_method).toBe("POST");
      expect(requestData.request_path).toBe("/api/users");
      expect(requestData.response_code).toBe(200);
      expect(requestData.processing_time).toBe(150);
    });

    it("should handle initial context data", async () => {
      await vision.observe(
        {
          name: "test.operation",
          initial: {
            requestId: "req-123",
            userAgent: "test-agent",
            clientInfo: {
              ipAddress: "127.0.0.1",
              browserType: "chrome",
            },
          },
        },
        async () => {
          vision.set("processedAt", Date.now());
        },
      );

      const context = capturedContexts[0];

      expect(context.data.get("request_id")).toBe("req-123");
      expect(context.data.get("user_agent")).toBe("test-agent");
      expect(context.data.get("processed_at")).toBeDefined();

      const clientInfo = context.data.get("client_info") as any;
      expect(clientInfo.ip_address).toBe("127.0.0.1");
      expect(clientInfo.browser_type).toBe("chrome");
    });
  });

  describe("when normalization is enabled with camelCase", () => {
    beforeEach(() => {
      vision.init({
        exporters: [testExporter],
        normalization: {
          enabled: true,
          keyCasing: "camelCase",
          deep: true,
        },
      });
    });

    it("should transform snake_case keys to camelCase", async () => {
      await vision.observe("test.operation", async () => {
        vision.set("user_id", "123");
        vision.set("first_name", "John");
        vision.set("last_login_at", "2023-01-01");
      });

      const context = capturedContexts[0];

      expect(context.data.get("userId")).toBe("123");
      expect(context.data.get("firstName")).toBe("John");
      expect(context.data.get("lastLoginAt")).toBe("2023-01-01");
    });
  });

  describe("when deep normalization is disabled", () => {
    beforeEach(() => {
      vision.init({
        exporters: [testExporter],
        normalization: {
          enabled: true,
          keyCasing: "snake_case",
          deep: false,
        },
      });
    });

    it("should only transform top-level keys", async () => {
      await vision.observe("test.operation", async () => {
        vision.set("userProfile", {
          firstName: "John",
          lastName: "Doe",
          address: {
            streetName: "Main St",
            cityName: "Boston",
          },
        });
      });

      const context = capturedContexts[0];
      const profile = context.data.get("user_profile") as any;

      // Top-level key should be transformed
      expect(context.data.get("user_profile")).toBeDefined();
      expect(context.data.get("userProfile")).toBeUndefined();

      // Nested keys should NOT be transformed
      expect(profile.firstName).toBe("John");
      expect(profile.lastName).toBe("Doe");
      expect(profile.address.streetName).toBe("Main St");
      expect(profile.address.cityName).toBe("Boston");

      // Transformed nested keys should not exist
      expect(profile.first_name).toBeUndefined();
      expect(profile.last_name).toBeUndefined();
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      vision.init({
        exporters: [testExporter],
        normalization: {
          enabled: true,
          keyCasing: "snake_case",
          deep: true,
        },
      });
    });

    it("should normalize context even when operation fails", async () => {
      const testError = new Error("Test error");

      try {
        await vision.observe("test.operation", async () => {
          vision.set("userId", "123");
          vision.set("operationStatus", "failed");
          throw testError;
        });
      } catch (err) {
        expect(err).toBe(testError);
      }

      expect(capturedContexts).toHaveLength(1);
      const context = capturedContexts[0];

      expect(context.data.get("user_id")).toBe("123");
      expect(context.data.get("operation_status")).toBe("failed");
    });
  });

  describe("multiple exporters", () => {
    it("should send normalized context to all exporters", async () => {
      const capturedContexts1: VisionContext[] = [];
      const capturedContexts2: VisionContext[] = [];

      const exporter1: VisionExporter = {
        name: "exporter-1",
        success: (ctx) => capturedContexts1.push(ctx),
      };

      const exporter2: VisionExporter = {
        name: "exporter-2",
        success: (ctx) => capturedContexts2.push(ctx),
      };

      vision.init({
        exporters: [exporter1, exporter2],
        normalization: {
          enabled: true,
          keyCasing: "snake_case",
          deep: true,
        },
      });

      await vision.observe("test.operation", async () => {
        vision.set("userId", "123");
      });

      expect(capturedContexts1).toHaveLength(1);
      expect(capturedContexts2).toHaveLength(1);

      expect(capturedContexts1[0].data.get("user_id")).toBe("123");
      expect(capturedContexts2[0].data.get("user_id")).toBe("123");
    });
  });

  describe("performance considerations", () => {
    it("should handle large datasets efficiently", async () => {
      vision.init({
        exporters: [testExporter],
        normalization: {
          enabled: true,
          keyCasing: "snake_case",
          deep: true,
        },
      });

      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        userId: `user-${i}`,
        firstName: `FirstName${i}`,
        lastName: `LastName${i}`,
        metadata: {
          createdAt: new Date().toISOString(),
          isActive: i % 2 === 0,
          loginCount: i * 10,
        },
      }));

      const startTime = Date.now();

      await vision.observe("test.operation", async () => {
        vision.set("largeUserList", largeDataset);
        vision.set("totalCount", largeDataset.length);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000);

      const context = capturedContexts[0];
      const userList = context.data.get("large_user_list") as any[];

      expect(userList).toHaveLength(1000);
      expect(userList[0].user_id).toBe("user-0");
      expect(userList[0].first_name).toBe("FirstName0");
      expect(userList[0].metadata.created_at).toBeDefined();
      expect(userList[0].metadata.is_active).toBe(true);
      expect(userList[0].metadata.login_count).toBe(0);
    });
  });
});
