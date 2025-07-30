import { vision } from "@rodrigopsasaki/vision";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lastValueFrom, of, throwError, delay } from "rxjs";

import { VisionInterceptor } from "../src/interceptor";
import { DEFAULT_VISION_NESTJS_OPTIONS, VISION_IGNORE_METADATA } from "../src/types";

describe("VisionInterceptor", () => {
  let interceptor: VisionInterceptor;
  let mockReflector: Reflector;
  let mockContext: ExecutionContext;
  let mockCallHandler: any;
  let capturedContexts: any[] = [];

  beforeEach(() => {
    // Reset captured contexts
    capturedContexts = [];

    // Mock Vision to capture contexts
    vi.spyOn(vision, "observe").mockImplementation(async (config, callback) => {
      const mockVisionContext = {
        id: "test-context-id",
        name: typeof config === "string" ? config : config.name,
        timestamp: new Date().toISOString(),
        data: new Map(),
      };

      // Mock vision.context() to return our mock context
      vi.spyOn(vision, "context").mockReturnValue(mockVisionContext);

      capturedContexts.push({ config, callback });
      return callback();
    });

    // Mock other vision methods
    vi.spyOn(vision, "set").mockImplementation(() => {});
    vi.spyOn(vision, "merge").mockImplementation(() => {});
    vi.spyOn(vision, "push").mockImplementation(() => {});

    // Create mock reflector
    mockReflector = {
      getAllAndOverride: vi.fn(),
    } as any;

    // Create interceptor
    interceptor = new VisionInterceptor(DEFAULT_VISION_NESTJS_OPTIONS, mockReflector);

    // Mock execution context
    mockContext = {
      getType: vi.fn().mockReturnValue("http"),
      getClass: vi.fn().mockReturnValue({ name: "TestController" }),
      getHandler: vi.fn().mockReturnValue({ name: "testMethod" }),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          method: "GET",
          path: "/test",
          ip: "127.0.0.1",
          headers: { "user-agent": "test-agent" },
          query: {},
        }),
        getResponse: vi.fn().mockReturnValue({
          statusCode: 200,
          setHeader: vi.fn(),
          getHeaders: vi.fn().mockReturnValue({}),
        }),
      }),
    } as any;

    // Mock call handler
    mockCallHandler = {
      handle: vi.fn().mockReturnValue(of("test result")),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("basic functionality", () => {
    it("should create a vision context for HTTP requests", async () => {
      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("test result");
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0].config).toMatchObject({
        name: "http.TestController.testMethod",
        scope: "http",
        source: "nestjs",
      });
    });

    it("should skip Vision context when globally disabled", async () => {
      const disabledInterceptor = new VisionInterceptor({ enabled: false }, mockReflector);
      
      const result$ = disabledInterceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("test result");
      expect(capturedContexts).toHaveLength(0);
    });

    it("should skip Vision context when method is marked with @VisionIgnore", async () => {
      mockReflector.getAllAndOverride = vi.fn()
        .mockReturnValueOnce(true) // VisionIgnore metadata
        .mockReturnValue(undefined);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("test result");
      expect(capturedContexts).toHaveLength(0);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        VISION_IGNORE_METADATA,
        [mockContext.getHandler(), mockContext.getClass()],
      );
    });

    it("should exclude routes based on configuration", async () => {
      const interceptorWithExclusions = new VisionInterceptor(
        { ...DEFAULT_VISION_NESTJS_OPTIONS, excludeRoutes: ["/test"] },
        mockReflector,
      );

      const result$ = interceptorWithExclusions.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("test result");
      expect(capturedContexts).toHaveLength(0);
    });
  });

  describe("context types", () => {
    it("should handle GraphQL contexts", async () => {
      mockContext.getType = vi.fn().mockReturnValue("graphql");
      mockContext.getArgs = vi.fn().mockReturnValue([
        null, // parent
        { id: "123" }, // args
        { req: { headers: { "user-agent": "graphql-client" } } }, // context
        { fieldName: "getUser", operation: { operation: "query" } }, // info
      ]);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("test result");
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0].config.scope).toBe("graphql");
    });

    it("should handle WebSocket contexts", async () => {
      mockContext.getType = vi.fn().mockReturnValue("ws");
      mockContext.switchToWs = vi.fn().mockReturnValue({
        getClient: vi.fn().mockReturnValue({
          id: "client-123",
          handshake: {
            address: "127.0.0.1",
            headers: { "user-agent": "ws-client" },
          },
        }),
        getData: vi.fn().mockReturnValue({ message: "hello" }),
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("test result");
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0].config.scope).toBe("ws");
    });

    it("should handle microservice contexts", async () => {
      mockContext.getType = vi.fn().mockReturnValue("rpc");
      mockContext.switchToRpc = vi.fn().mockReturnValue({
        getData: vi.fn().mockReturnValue({ userId: "123", action: "create" }),
        getContext: vi.fn().mockReturnValue({ pattern: "user.create", id: "msg-123" }),
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("test result");
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0].config.scope).toBe("rpc");
    });
  });

  describe("error handling", () => {
    it("should capture error information when handler throws", async () => {
      const testError = new Error("Test error");
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => testError));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      await expect(lastValueFrom(result$)).rejects.toThrow("Test error");
      expect(capturedContexts).toHaveLength(1);
      expect(vision.set).toHaveBeenCalledWith("success", false);
      expect(vision.merge).toHaveBeenCalledWith("error", expect.objectContaining({
        name: "Error",
        message: "Test error",
      }));
    });
  });

  describe("performance tracking", () => {
    it("should track execution time when enabled", async () => {
      const performanceInterceptor = new VisionInterceptor(
        {
          ...DEFAULT_VISION_NESTJS_OPTIONS,
          performance: { trackExecutionTime: true, slowOperationThreshold: 100 },
        },
        mockReflector,
      );

      // Mock a slow operation with Observable delay
      mockCallHandler.handle = vi.fn().mockReturnValue(
        of("slow result").pipe(delay(150))
      );

      const result$ = performanceInterceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("slow result");
      expect(vision.set).toHaveBeenCalledWith("execution_time_ms", expect.any(Number));
      expect(vision.set).toHaveBeenCalledWith("slow_operation", true);
    });
  });

  describe("method-level configuration", () => {
    it("should use method-level context configuration", async () => {
      const methodConfig = {
        name: "custom.operation.name",
        scope: "custom",
        initial: { custom_data: "test" },
      };

      mockReflector.getAllAndOverride = vi.fn()
        .mockReturnValueOnce(false) // VisionIgnore
        .mockReturnValueOnce(methodConfig) // VisionContext
        .mockReturnValue(undefined);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toBe("test result");
      expect(capturedContexts[0].config).toMatchObject({
        name: "custom.operation.name",
        scope: "custom",
        initial: expect.objectContaining({
          custom_data: "test",
        }),
      });
    });

    it("should apply capture configuration", async () => {
      const captureConfig = {
        request: true,
        headers: true,
        body: true,
      };

      mockReflector.getAllAndOverride = vi.fn()
        .mockReturnValueOnce(false) // VisionIgnore
        .mockReturnValueOnce(undefined) // VisionContext
        .mockReturnValueOnce(captureConfig); // VisionCapture

      // Mock request with body
      mockContext.switchToHttp().getRequest = vi.fn().mockReturnValue({
        method: "POST",
        path: "/test",
        headers: { "content-type": "application/json", authorization: "Bearer token" },
        body: { username: "test", password: "secret" },
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);

      expect(vision.merge).toHaveBeenCalledWith("request", expect.objectContaining({
        method: "POST",
        path: "/test",
        headers: expect.any(Object),
        body: expect.any(Object),
      }));
    });
  });

  describe("data redaction", () => {
    it("should redact sensitive headers", async () => {
      mockContext.switchToHttp().getRequest = vi.fn().mockReturnValue({
        method: "GET",
        path: "/test",
        headers: {
          authorization: "Bearer secret-token",
          "x-api-key": "api-key-123",
          "content-type": "application/json",
        },
      });

      const interceptorWithCapture = new VisionInterceptor(
        { ...DEFAULT_VISION_NESTJS_OPTIONS, captureHeaders: true },
        mockReflector,
      );

      const result$ = interceptorWithCapture.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);

      expect(vision.merge).toHaveBeenCalledWith("request", expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "[REDACTED]",
          "x-api-key": "[REDACTED]",
          "content-type": "application/json",
        }),
      }));
    });
  });
});