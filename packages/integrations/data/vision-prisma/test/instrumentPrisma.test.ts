import { vision } from "@rodrigopsasaki/vision";
import type { VisionExporter } from "@rodrigopsasaki/vision";
import { describe, test, expect, vi, beforeEach } from "vitest";

import { instrumentPrisma, instrumentPrismaWithQueryLogging } from "../src/instrumentPrisma";

describe("Vision Prisma Instrumentation", () => {
  let mockExporter: VisionExporter;
  let mockPrismaClient: any;

  beforeEach(() => {
    mockExporter = {
      name: "test-exporter",
      success: vi.fn(),
      error: vi.fn(),
    };

    vision.init({ exporters: [mockExporter] });
    vi.clearAllMocks();

    // Mock Prisma client
    mockPrismaClient = {
      $on: vi.fn(),
      $use: vi.fn(),
      $transaction: vi.fn(),
    };
  });

  describe("instrumentPrisma", () => {
    test("function exists and is callable", () => {
      expect(typeof instrumentPrisma).toBe("function");
      expect(instrumentPrisma.length).toBe(2); // client, config
    });

    test("handles client without $on method gracefully", () => {
      const invalidClient = {};
      const result = instrumentPrisma(invalidClient as any);
      expect(result).toBe(invalidClient);
    });
  });

  describe("instrumentPrismaWithQueryLogging", () => {
    test("function exists and is callable", () => {
      expect(typeof instrumentPrismaWithQueryLogging).toBe("function");
      expect(instrumentPrismaWithQueryLogging.length).toBe(2); // client, options
    });

    test("returns the passed client", () => {
      const invalidClient = {};
      const result = instrumentPrismaWithQueryLogging(invalidClient as any);
      expect(result).toBe(invalidClient);
    });
  });
});