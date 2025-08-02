/**
 * Advanced Vision Koa Integration Example
 *
 * This example demonstrates advanced features:
 * - Custom configuration with performance tracking
 * - User authentication and tenant extraction
 * - Correlation ID handling
 * - Custom metadata extraction
 * - Business logic with multiple operations
 * - Error handling with custom transformers
 * - Koa-specific features (state, cookies, etc.)
 */

import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import session from "koa-session";
import { createVisionMiddleware } from "@rodrigopsasaki/vision-koa";
import { vision } from "@rodrigopsasaki/vision";

// Custom interfaces for our application
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "manager";
  tenantId: string;
  permissions: string[];
}

interface AppContext extends Koa.Context {
  user?: User;
  tenant?: string;
}

const app = new Koa();
const router = new Router();

// Session configuration
app.keys = ["koa-vision-demo-secret-key"];
app.use(
  session(
    {
      key: "koa:sess",
      maxAge: 86400000, // 24 hours
      overwrite: true,
      httpOnly: true,
      signed: true,
      rolling: false,
      renew: false,
    },
    app,
  ),
);

// Body parser middleware
app.use(bodyParser());

// Mock authentication middleware
app.use(async (ctx: AppContext, next) => {
  // Skip auth for health and public routes
  if (
    ctx.path.startsWith("/health") ||
    ctx.path.startsWith("/public") ||
    ctx.path.startsWith("/auth")
  ) {
    return next();
  }

  // Extract user from session or headers
  const authHeader = ctx.headers.authorization;
  const sessionUser = ctx.session?.user;

  if (sessionUser) {
    ctx.user = sessionUser;
    ctx.tenant = sessionUser.tenantId;
  } else if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    // Mock JWT validation
    const user = await validateToken(token);
    if (user) {
      ctx.user = user;
      ctx.tenant = user.tenantId;
      ctx.session!.user = user; // Store in session
    }
  }

  await next();
});

// Register Vision middleware with advanced configuration
app.use(
  createVisionMiddleware({
    // Enable comprehensive tracking
    captureBody: true,
    captureHeaders: true,
    captureKoaMetadata: true,

    // Performance monitoring
    performance: {
      trackExecutionTime: true,
      slowOperationThreshold: 500,
      trackMemoryUsage: true,
    },

    // Custom context naming with tenant information
    contextNameGenerator: (ctx: AppContext) => {
      const tenant = ctx.tenant ? `[${ctx.tenant}]` : "";
      const user = ctx.user ? `{${ctx.user.role}}` : "";
      return `${ctx.method.toLowerCase()}.${ctx.path}${tenant}${user}`;
    },

    // Custom user extraction
    extractUser: (ctx: AppContext) => {
      if (ctx.user) {
        return {
          id: ctx.user.id,
          name: ctx.user.name,
          role: ctx.user.role,
          email: ctx.user.email, // Will be redacted
          permissions: ctx.user.permissions,
        };
      }
      return undefined;
    },

    // Custom correlation ID extraction
    extractCorrelationId: (ctx) => {
      return (
        (ctx.headers["x-correlation-id"] as string) ||
        (ctx.headers["x-request-id"] as string) ||
        (ctx.headers["x-trace-id"] as string) ||
        ctx.session?.correlationId
      );
    },

    // Custom tenant extraction
    extractTenant: (ctx: AppContext) => {
      return ctx.tenant || (ctx.headers["x-tenant-id"] as string) || (ctx.query.tenant as string);
    },

    // Advanced metadata extraction
    extractMetadata: (ctx: AppContext) => {
      const metadata: Record<string, unknown> = {};

      // Business context
      if (ctx.user) {
        metadata.user_role = ctx.user.role;
        metadata.tenant_id = ctx.user.tenantId;
        metadata.permission_count = ctx.user.permissions.length;
      }

      // Request context
      if (ctx.headers["x-feature-flag"]) {
        metadata.feature_flags = ctx.headers["x-feature-flag"];
      }

      if (ctx.headers["x-client-version"]) {
        metadata.client_version = ctx.headers["x-client-version"];
      }

      if (ctx.headers["user-agent"]) {
        const ua = ctx.headers["user-agent"] as string;
        metadata.client_type = ua.includes("Mobile") ? "mobile" : "desktop";
      }

      // Session information
      if (ctx.session) {
        metadata.session_age = ctx.session.maxAge;
        metadata.session_new = ctx.session.isNew;
      }

      // Koa-specific metadata
      metadata.koa_fresh = ctx.fresh;
      metadata.koa_secure = ctx.secure;
      metadata.koa_protocol = ctx.protocol;

      return metadata;
    },

    // Custom error transformer
    errorHandling: {
      captureErrors: true,
      captureStackTrace: process.env.NODE_ENV !== "production",
      transformError: (error, ctx: AppContext) => {
        const baseError = {
          name: error.name,
          message: error.message,
          status: (error as any).status,
          code: (error as any).code,
          expose: (error as any).expose,
        };

        // Add user context to errors
        if (ctx.user) {
          return {
            ...baseError,
            user_id: ctx.user.id,
            tenant_id: ctx.user.tenantId,
            user_role: ctx.user.role,
          };
        }

        return baseError;
      },
    },

    // Enhanced security configuration
    redactHeaders: [
      "authorization",
      "cookie",
      "x-api-key",
      "x-auth-token",
      "x-session-token",
      "x-csrf-token",
    ],
    redactBodyFields: ["password", "token", "secret", "creditCard", "ssn", "apiKey", "privateKey"],
  }),
);

// Global error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    // Vision will automatically capture this error
    console.error("Application error:", err);

    ctx.status = err.status || 500;
    ctx.body = {
      error: err.expose ? err.message : "Internal Server Error",
      code: err.code,
      timestamp: new Date().toISOString(),
    };
  }
});

// Authentication routes
router.post("/auth/login", async (ctx: AppContext) => {
  const { email, password } = ctx.request.body as any;

  vision.set("operation", "user_login");
  vision.set("login_attempt", true);

  if (!email || !password) {
    vision.set("login_validation_error", "missing_credentials");
    ctx.status = 400;
    ctx.body = { error: "Email and password required" };
    return;
  }

  const user = await authenticateUser(email, password);

  if (!user) {
    vision.set("login_failed", true);
    ctx.status = 401;
    ctx.body = { error: "Invalid credentials" };
    return;
  }

  // Store user in session
  ctx.session!.user = user;
  ctx.user = user;
  ctx.tenant = user.tenantId;

  vision.set("login_successful", true);
  vision.set("user_role", user.role);
  vision.set("tenant_id", user.tenantId);

  ctx.body = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token: generateToken(user),
  };
});

router.post("/auth/logout", requireAuth, async (ctx: AppContext) => {
  vision.set("operation", "user_logout");
  vision.set("user_id", ctx.user!.id);

  ctx.session = null;
  ctx.body = { message: "Logged out successfully" };
});

// User management routes
router.get("/api/profile", requireAuth, async (ctx: AppContext) => {
  vision.set("operation", "get_profile");
  vision.set("user_authenticated", true);

  // Simulate profile enrichment
  await simulateDbQuery("profile_enrichment", 200);

  const profile = await enrichUserProfile(ctx.user!);

  vision.set("profile_enriched", true);
  vision.set("profile_data_sources", profile.dataSources.length);

  ctx.body = profile;
});

router.put("/api/profile", requireAuth, async (ctx: AppContext) => {
  const updates = ctx.request.body as any;

  vision.set("operation", "update_profile");
  vision.set("update_fields", Object.keys(updates));

  // Validate updates
  const validationResult = await validateProfileUpdates(updates);
  if (!validationResult.valid) {
    vision.set("validation_errors", validationResult.errors);
    ctx.status = 400;
    ctx.body = { errors: validationResult.errors };
    return;
  }

  // Update profile
  const updatedUser = await updateUserProfile(ctx.user!.id, updates);

  // Update session
  ctx.session!.user = updatedUser;
  ctx.user = updatedUser;

  vision.set("profile_updated", true);
  vision.set("updated_fields_count", Object.keys(updates).length);

  ctx.body = updatedUser;
});

// Business logic routes
router.post("/api/orders", requireAuth, async (ctx: AppContext) => {
  const orderData = ctx.request.body as any;

  vision.set("operation", "create_order");
  vision.set("order_type", orderData.type);
  vision.set("items_count", orderData.items?.length || 0);

  try {
    // Multi-step order processing
    vision.set("step", "validation");
    await validateOrder(orderData, ctx.user!);

    vision.set("step", "pricing");
    const pricing = await calculatePricing(orderData, ctx.user!);
    vision.set("order_total", pricing.total);
    vision.set("discount_applied", pricing.discountApplied);

    vision.set("step", "inventory_check");
    const inventoryStatus = await checkInventory(orderData.items);
    vision.set("inventory_available", inventoryStatus.available);

    if (!inventoryStatus.available) {
      vision.set("inventory_insufficient", true);
      vision.set("missing_items", inventoryStatus.missingItems);
      ctx.status = 409;
      ctx.body = {
        error: "Insufficient inventory",
        missingItems: inventoryStatus.missingItems,
      };
      return;
    }

    vision.set("step", "payment_processing");
    const paymentResult = await processPayment({
      amount: pricing.total,
      currency: "USD",
      userId: ctx.user!.id,
      tenantId: ctx.user!.tenantId,
    });

    if (!paymentResult.success) {
      vision.set("payment_failed", true);
      vision.set("payment_error", paymentResult.error);
      ctx.status = 402;
      ctx.body = {
        error: "Payment failed",
        reason: paymentResult.error,
      };
      return;
    }

    vision.set("step", "order_creation");
    const order = await createOrder({
      ...orderData,
      userId: ctx.user!.id,
      tenantId: ctx.user!.tenantId,
      pricing,
      paymentId: paymentResult.paymentId,
    });

    vision.set("order_created", true);
    vision.set("order_id", order.id);
    vision.set("processing_time_ms", Date.now() - ctx.state.startTime);

    ctx.status = 201;
    ctx.body = order;
  } catch (error) {
    vision.set("order_creation_failed", true);
    vision.set("failure_step", ctx.state.currentStep);
    throw error;
  }
});

// Admin routes
router.get(
  "/api/admin/analytics",
  requireAuth,
  requireRole(["admin", "manager"]),
  async (ctx: AppContext) => {
    vision.set("operation", "admin_analytics");
    vision.set("admin_user", true);

    const analytics = await generateAnalytics(ctx.user!.tenantId);

    vision.set("analytics_generated", true);
    vision.set("data_points", analytics.dataPoints);
    vision.set("time_range", analytics.timeRange);

    ctx.body = analytics;
  },
);

// Public routes
router.get("/public/status", async (ctx) => {
  vision.set("operation", "public_status");

  ctx.body = {
    status: "operational",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  };
});

// Health check (excluded from Vision by default)
router.get("/health", async (ctx) => {
  ctx.body = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };
});

// Register routes
app.use(router.routes());
app.use(router.allowedMethods());

// Middleware helpers
async function requireAuth(ctx: AppContext, next: Koa.Next) {
  if (!ctx.user) {
    ctx.status = 401;
    ctx.body = { error: "Authentication required" };
    return;
  }
  await next();
}

function requireRole(roles: string[]) {
  return async (ctx: AppContext, next: Koa.Next) => {
    if (!ctx.user || !roles.includes(ctx.user.role)) {
      ctx.status = 403;
      ctx.body = { error: "Insufficient permissions" };
      return;
    }
    await next();
  };
}

// Mock service functions
async function validateToken(token: string): Promise<User | null> {
  await simulateDbQuery("token_validation", 50);

  const users: Record<string, User> = {
    "user-token": {
      id: "user_123",
      name: "John Doe",
      email: "john@example.com",
      role: "user",
      tenantId: "tenant_abc",
      permissions: ["read:profile", "write:profile"],
    },
    "admin-token": {
      id: "admin_456",
      name: "Jane Admin",
      email: "jane@example.com",
      role: "admin",
      tenantId: "tenant_xyz",
      permissions: ["read:*", "write:*", "admin:*"],
    },
    "manager-token": {
      id: "manager_789",
      name: "Bob Manager",
      email: "bob@example.com",
      role: "manager",
      tenantId: "tenant_abc",
      permissions: ["read:*", "write:team", "manage:team"],
    },
  };

  return users[token] || null;
}

async function authenticateUser(email: string, password: string): Promise<User | null> {
  await simulateDbQuery("user_authentication", 150);

  // Mock authentication
  if (email === "john@example.com" && password === "password") {
    return {
      id: "user_123",
      name: "John Doe",
      email: "john@example.com",
      role: "user",
      tenantId: "tenant_abc",
      permissions: ["read:profile", "write:profile"],
    };
  }

  return null;
}

function generateToken(user: User): string {
  // In real app, generate a proper JWT
  return `${user.role}-token`;
}

async function enrichUserProfile(user: User) {
  await simulateDbQuery("profile_enrichment", 300);

  return {
    ...user,
    preferences: {
      theme: "dark",
      notifications: true,
      timezone: "UTC",
    },
    stats: {
      loginCount: Math.floor(Math.random() * 100),
      lastLogin: new Date().toISOString(),
    },
    dataSources: ["database", "cache", "analytics"],
  };
}

async function validateProfileUpdates(updates: any) {
  await simulateDbQuery("validation", 100);

  const errors: string[] = [];

  if (updates.email && !updates.email.includes("@")) {
    errors.push("Invalid email format");
  }

  if (updates.name && updates.name.length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function updateUserProfile(userId: string, updates: any) {
  await simulateDbQuery("update_profile", 200);

  // Mock updated user
  return {
    id: userId,
    name: updates.name || "John Doe",
    email: updates.email || "john@example.com",
    role: "user",
    tenantId: "tenant_abc",
    permissions: ["read:profile", "write:profile"],
    updatedAt: new Date().toISOString(),
  };
}

async function validateOrder(orderData: any, user: User) {
  await simulateDbQuery("order_validation", 100);

  if (!orderData.items || orderData.items.length === 0) {
    throw new Error("Order must contain items");
  }

  if (!orderData.type) {
    throw new Error("Order type is required");
  }
}

async function calculatePricing(orderData: any, user: User) {
  await simulateDbQuery("pricing_calculation", 150);

  const subtotal = orderData.items.reduce((sum: number, item: any) => sum + (item.price || 10), 0);
  const discount = user.role === "admin" ? subtotal * 0.1 : 0;
  const total = subtotal - discount;

  return {
    subtotal,
    discount,
    total,
    discountApplied: discount > 0,
  };
}

async function checkInventory(items: any[]) {
  await simulateDbQuery("inventory_check", 200);

  const available = Math.random() > 0.1; // 90% success rate
  const missingItems = available ? [] : ["item_123"];

  return { available, missingItems };
}

async function processPayment(paymentData: any) {
  await simulateDbQuery("payment_processing", 400);

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
  await simulateDbQuery("create_order", 250);

  return {
    id: `order_${Date.now()}`,
    ...orderData,
    status: "created",
    createdAt: new Date().toISOString(),
  };
}

async function generateAnalytics(tenantId: string) {
  await simulateDbQuery("analytics_generation", 600);

  return {
    tenantId,
    timeRange: "30d",
    dataPoints: 1000,
    metrics: {
      users: Math.floor(Math.random() * 1000),
      orders: Math.floor(Math.random() * 500),
      revenue: Math.floor(Math.random() * 50000),
    },
    generatedAt: new Date().toISOString(),
  };
}

async function simulateDbQuery(operation: string, delay: number) {
  vision.set(`db_${operation}_start`, Date.now());
  await new Promise((resolve) => setTimeout(resolve, delay));
  vision.set(`db_${operation}_duration`, delay);
}

// Start the server
const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`🚀 Advanced Koa server with Vision is running on http://localhost:${PORT}`);
  console.log("");
  console.log("📊 Try these endpoints:");
  console.log("");
  console.log("🔓 Public routes:");
  console.log("  GET /public/status");
  console.log("  GET /health");
  console.log("");
  console.log("🔐 Authentication:");
  console.log('  POST /auth/login (JSON: {"email": "john@example.com", "password": "password"})');
  console.log("  POST /auth/logout");
  console.log("");
  console.log("👤 User routes (use session or add header: Authorization: Bearer user-token):");
  console.log("  GET /api/profile");
  console.log('  PUT /api/profile (JSON: {"name": "New Name"})');
  console.log('  POST /api/orders (JSON: {"type": "standard", "items": [{"price": 100}]})');
  console.log("");
  console.log("👑 Admin routes (add header: Authorization: Bearer admin-token):");
  console.log("  GET /api/admin/analytics");
  console.log("");
  console.log("🔍 Add these headers for enhanced tracking:");
  console.log("  X-Correlation-ID: your-correlation-id");
  console.log("  X-Feature-Flag: feature-name");
  console.log("  X-Client-Version: 1.2.3");
  console.log("  X-Tenant-ID: tenant-123");
  console.log("");
  console.log("📈 Watch the console for Vision context output!");
});
