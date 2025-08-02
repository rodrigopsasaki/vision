/**
 * Advanced Vision Fastify Integration Example
 *
 * This example demonstrates advanced features:
 * - Custom configuration with performance tracking
 * - User authentication and extraction
 * - Correlation ID handling
 * - Custom metadata extraction
 * - Route-specific behavior
 * - Error handling with custom transformers
 */

import Fastify, { FastifyRequest } from "fastify";
import { visionPlugin } from "@rodrigopsasaki/vision-fastify";
import { vision } from "@rodrigopsasaki/vision";

// Custom interfaces for our application
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  tenantId: string;
}

interface AuthenticatedRequest extends FastifyRequest {
  user?: User;
  tenant?: string;
}

const fastify = Fastify({
  logger: {
    level: "info",
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          "user-agent": req.headers["user-agent"],
          "x-correlation-id": req.headers["x-correlation-id"],
        },
      }),
    },
  },
});

// Mock authentication middleware
fastify.addHook("preHandler", async (request: AuthenticatedRequest) => {
  // Skip auth for health and public routes
  if (request.url.startsWith("/health") || request.url.startsWith("/public")) {
    return;
  }

  // Mock user extraction from JWT token
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    // In real app, you'd validate the JWT token
    if (token === "valid-token") {
      request.user = {
        id: "user_123",
        name: "John Doe",
        email: "john@example.com",
        role: "user",
        tenantId: "tenant_abc",
      };
      request.tenant = "tenant_abc";
    } else if (token === "admin-token") {
      request.user = {
        id: "admin_456",
        name: "Jane Admin",
        email: "jane@example.com",
        role: "admin",
        tenantId: "tenant_xyz",
      };
      request.tenant = "tenant_xyz";
    }
  }
});

// Register Vision plugin with advanced configuration
await fastify.register(visionPlugin, {
  // Enable comprehensive tracking
  captureBody: true,
  captureHeaders: true,

  // Performance monitoring
  performance: {
    trackExecutionTime: true,
    slowOperationThreshold: 500, // 500ms threshold
    trackMemoryUsage: true,
  },

  // Custom context naming
  contextNameGenerator: (request: AuthenticatedRequest) => {
    const route = request.routeOptions?.url || request.url;
    const tenant = request.tenant ? `[${request.tenant}]` : "";
    return `${request.method.toLowerCase()}.${route}${tenant}`;
  },

  // Custom user extraction
  extractUser: (request: AuthenticatedRequest) => {
    if (request.user) {
      return {
        id: request.user.id,
        name: request.user.name,
        role: request.user.role,
        email: request.user.email, // Note: will be redacted by default
      };
    }
    return undefined;
  },

  // Custom correlation ID extraction
  extractCorrelationId: (request) => {
    return (
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string) ||
      (request.headers["x-trace-id"] as string)
    );
  },

  // Custom tenant extraction
  extractTenant: (request: AuthenticatedRequest) => {
    return request.tenant || request.headers["x-tenant-id"];
  },

  // Additional metadata extraction
  extractMetadata: (request: AuthenticatedRequest) => {
    const metadata: Record<string, unknown> = {};

    // Add business context
    if (request.user) {
      metadata.user_role = request.user.role;
      metadata.tenant_id = request.user.tenantId;
    }

    // Add request context
    if (request.headers["x-feature-flag"]) {
      metadata.feature_flags = request.headers["x-feature-flag"];
    }

    if (request.headers["x-client-version"]) {
      metadata.client_version = request.headers["x-client-version"];
    }

    return metadata;
  },

  // Custom error handling
  errorHandling: {
    captureErrors: true,
    captureStackTrace: process.env.NODE_ENV !== "production",
    transformError: (error, request: AuthenticatedRequest) => {
      const baseError = {
        name: error.name,
        message: error.message,
        statusCode: (error as any).statusCode,
        code: (error as any).code,
      };

      // Add context for authenticated users
      if (request.user) {
        return {
          ...baseError,
          user_id: request.user.id,
          tenant_id: request.user.tenantId,
          user_role: request.user.role,
        };
      }

      return baseError;
    },
  },

  // Security: additional sensitive fields to redact
  redactHeaders: ["authorization", "cookie", "x-api-key", "x-auth-token", "x-session-token"],
  redactBodyFields: ["password", "token", "secret", "creditCard", "ssn"],
});

// Protected routes requiring authentication
fastify.get(
  "/api/profile",
  {
    preHandler: [requireAuth],
  },
  async (request: AuthenticatedRequest) => {
    vision.set("operation", "get_profile");
    vision.set("user_authenticated", true);

    // Simulate slow database operation
    await simulateDbQuery("profile", 300);

    return {
      user: request.user,
      tenant: request.tenant,
      timestamp: new Date().toISOString(),
    };
  },
);

// Admin-only route
fastify.get(
  "/api/admin/users",
  {
    preHandler: [requireAuth, requireAdmin],
  },
  async (request: AuthenticatedRequest) => {
    vision.set("operation", "list_users");
    vision.set("admin_operation", true);

    // Simulate potentially slow admin query
    await simulateDbQuery("admin_users", 800);

    const users = await getAllUsers();
    vision.set("users_count", users.length);

    return { users, total: users.length };
  },
);

// Route with business logic and multiple operations
fastify.post(
  "/api/orders",
  {
    preHandler: [requireAuth],
  },
  async (request: AuthenticatedRequest, reply) => {
    const orderData = request.body as any;

    vision.set("operation", "create_order");
    vision.set("order_type", orderData.type);

    try {
      // Validate order
      vision.set("step", "validation");
      await validateOrder(orderData);

      // Check inventory
      vision.set("step", "inventory_check");
      const inventoryOk = await checkInventory(orderData.items);

      if (!inventoryOk) {
        vision.set("inventory_insufficient", true);
        return reply.status(400).send({
          error: "Insufficient inventory",
          code: "INVENTORY_ERROR",
        });
      }

      // Process payment
      vision.set("step", "payment_processing");
      const paymentResult = await processPayment(orderData.payment);

      if (!paymentResult.success) {
        vision.set("payment_failed", true);
        vision.set("payment_error", paymentResult.error);
        return reply.status(402).send({
          error: "Payment failed",
          code: "PAYMENT_ERROR",
        });
      }

      // Create order
      vision.set("step", "order_creation");
      const order = await createOrder({
        ...orderData,
        userId: request.user!.id,
        tenantId: request.user!.tenantId,
        paymentId: paymentResult.paymentId,
      });

      vision.set("order_created", true);
      vision.set("order_id", order.id);
      vision.set("order_total", order.total);

      return reply.status(201).send(order);
    } catch (error) {
      vision.set("order_creation_failed", true);
      throw error;
    }
  },
);

// Public route (no auth required)
fastify.get("/public/status", async () => {
  vision.set("operation", "public_status");

  return {
    status: "operational",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };
});

// Route that intentionally triggers slow operation warning
fastify.get(
  "/api/slow-operation",
  {
    preHandler: [requireAuth],
  },
  async (request: AuthenticatedRequest) => {
    vision.set("operation", "slow_demo");

    // This will trigger the slow operation threshold (> 500ms)
    await simulateDbQuery("slow_query", 1200);

    return { message: "This was a slow operation" };
  },
);

// Health check (excluded from Vision by default)
fastify.get("/health", async () => {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

// Authentication helpers
async function requireAuth(request: AuthenticatedRequest, reply: any) {
  if (!request.user) {
    return reply.status(401).send({ error: "Authentication required" });
  }
}

async function requireAdmin(request: AuthenticatedRequest, reply: any) {
  if (request.user?.role !== "admin") {
    return reply.status(403).send({ error: "Admin access required" });
  }
}

// Mock business logic functions
async function simulateDbQuery(operation: string, delay: number) {
  vision.set(`db_${operation}_start`, Date.now());
  await new Promise((resolve) => setTimeout(resolve, delay));
  vision.set(`db_${operation}_duration`, delay);
}

async function validateOrder(orderData: any) {
  await simulateDbQuery("validate_order", 50);
  if (!orderData.items || orderData.items.length === 0) {
    throw new Error("Order must contain items");
  }
}

async function checkInventory(items: any[]) {
  await simulateDbQuery("inventory_check", 150);
  return Math.random() > 0.1; // 90% success rate
}

async function processPayment(payment: any) {
  await simulateDbQuery("payment_processing", 300);

  if (Math.random() > 0.05) {
    // 95% success rate
    return {
      success: true,
      paymentId: `pay_${Date.now()}`,
    };
  }

  return {
    success: false,
    error: "Payment declined",
  };
}

async function createOrder(orderData: any) {
  await simulateDbQuery("create_order", 200);

  return {
    id: `order_${Date.now()}`,
    ...orderData,
    total: orderData.items.reduce((sum: number, item: any) => sum + item.price, 0),
    status: "created",
    createdAt: new Date().toISOString(),
  };
}

async function getAllUsers() {
  await simulateDbQuery("get_all_users", 400);

  return [
    { id: "user_1", name: "Alice", role: "user" },
    { id: "user_2", name: "Bob", role: "user" },
    { id: "admin_1", name: "Charlie", role: "admin" },
  ];
}

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: "0.0.0.0" });
    console.log("🚀 Advanced Fastify server with Vision is running on http://localhost:3001");
    console.log("");
    console.log("📊 Try these endpoints:");
    console.log("");
    console.log("🔓 Public routes:");
    console.log("  GET /public/status");
    console.log("  GET /health");
    console.log("");
    console.log("🔐 Authenticated routes (add header: Authorization: Bearer valid-token):");
    console.log("  GET /api/profile");
    console.log("  GET /api/slow-operation");
    console.log("  POST /api/orders (with JSON body)");
    console.log("");
    console.log("👑 Admin routes (add header: Authorization: Bearer admin-token):");
    console.log("  GET /api/admin/users");
    console.log("");
    console.log("🔍 Add these headers for enhanced tracking:");
    console.log("  X-Correlation-ID: your-correlation-id");
    console.log("  X-Feature-Flag: feature-name");
    console.log("  X-Client-Version: 1.2.3");
    console.log("");
    console.log("📈 Watch the console for Vision context output!");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
