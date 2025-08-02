/**
 * Microservice Integration Example with Vision Fastify
 *
 * This example demonstrates a real-world microservice architecture:
 * - Inter-service communication with correlation ID propagation
 * - Circuit breaker pattern
 * - Health checks and service discovery
 * - Distributed tracing with Vision
 * - Load balancing and retry logic
 * - Service mesh integration patterns
 */

import Fastify, { FastifyRequest } from "fastify";
import { visionPlugin } from "@rodrigopsasaki/vision-fastify";
import { vision } from "@rodrigopsasaki/vision";

// Service configuration
const SERVICE_NAME = "user-service";
const SERVICE_VERSION = "1.2.3";
const PORT = process.env.PORT || 3006;

// External service URLs (in real world, from service discovery)
const SERVICES = {
  AUTH_SERVICE: process.env.AUTH_SERVICE_URL || "http://localhost:3100",
  NOTIFICATION_SERVICE: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3101",
  ANALYTICS_SERVICE: process.env.ANALYTICS_SERVICE_URL || "http://localhost:3102",
  PAYMENT_SERVICE: process.env.PAYMENT_SERVICE_URL || "http://localhost:3103",
};

const fastify = Fastify({
  logger: {
    level: "info",
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        correlationId: req.headers["x-correlation-id"],
        serviceChain: req.headers["x-service-chain"],
      }),
    },
  },
});

// Circuit breaker state
const circuitBreakers = new Map<
  string,
  {
    failures: number;
    lastFailure: number;
    state: "closed" | "open" | "half-open";
  }
>();

// Register Vision plugin with microservice configuration
await fastify.register(visionPlugin, {
  // Enhanced metadata for microservices
  extractMetadata: (request) => {
    return {
      service_name: SERVICE_NAME,
      service_version: SERVICE_VERSION,
      deployment_env: process.env.NODE_ENV || "development",
      pod_name: process.env.POD_NAME,
      node_name: process.env.NODE_NAME,
      service_chain: request.headers["x-service-chain"] || SERVICE_NAME,
      request_id: request.headers["x-request-id"],
      user_agent: request.headers["user-agent"],
      client_ip: request.ip,
    };
  },

  // Enhanced correlation ID handling
  extractCorrelationId: (request) => {
    return (
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string) ||
      (request.headers["x-trace-id"] as string) ||
      generateCorrelationId()
    );
  },

  // Custom context naming for microservices
  contextNameGenerator: (request) => {
    const service = SERVICE_NAME;
    const route = request.routeOptions?.url || request.url;
    const correlationId = request.headers["x-correlation-id"] as string;
    return `${service}.${request.method.toLowerCase()}.${route}.${correlationId?.slice(-8) || "unknown"}`;
  },

  // Performance monitoring for distributed systems
  performance: {
    trackExecutionTime: true,
    slowOperationThreshold: 1000, // Microservices can be slower due to network
    trackMemoryUsage: true,
  },

  // Enhanced error tracking for microservices
  errorHandling: {
    captureErrors: true,
    captureStackTrace: process.env.NODE_ENV !== "production",
    transformError: (error, request) => ({
      name: error.name,
      message: error.message,
      statusCode: (error as any).statusCode,
      service: SERVICE_NAME,
      service_version: SERVICE_VERSION,
      correlation_id: request.headers["x-correlation-id"],
      service_chain: request.headers["x-service-chain"],
      upstream_service: (error as any).upstreamService,
      circuit_breaker_state: (error as any).circuitBreakerState,
    }),
  },
});

// Service mesh headers middleware
fastify.addHook("preHandler", async (request, reply) => {
  const correlationId = (request.headers["x-correlation-id"] as string) || generateCorrelationId();
  const serviceChain = (request.headers["x-service-chain"] as string) || SERVICE_NAME;

  // Add service to chain if not already present
  const updatedChain = serviceChain.includes(SERVICE_NAME)
    ? serviceChain
    : `${serviceChain}->${SERVICE_NAME}`;

  // Set response headers for downstream services
  reply.header("X-Correlation-ID", correlationId);
  reply.header("X-Service-Chain", updatedChain);
  reply.header("X-Service-Name", SERVICE_NAME);
  reply.header("X-Service-Version", SERVICE_VERSION);

  // Store in request for downstream calls
  (request as any).correlationId = correlationId;
  (request as any).serviceChain = updatedChain;
});

// User management endpoints
fastify.get("/api/users/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  vision.set("operation", "get_user");
  vision.set("user_id", id);
  vision.set("service_operation", "user_lookup");

  try {
    // Get user from database
    vision.set("step", "database_lookup");
    const user = await getUserFromDatabase(id);

    if (!user) {
      vision.set("user_not_found", true);
      return reply.status(404).send({ error: "User not found" });
    }

    // Enrich user data from multiple services
    vision.set("step", "service_enrichment");
    const [authData, analytics] = await Promise.allSettled([
      callAuthService("GET", `/users/${id}/permissions`, request as any),
      callAnalyticsService("GET", `/users/${id}/stats`, request as any),
    ]);

    // Handle service responses
    const enrichedUser = {
      ...user,
      permissions: authData.status === "fulfilled" ? authData.value.permissions : [],
      analytics: analytics.status === "fulfilled" ? analytics.value : null,
    };

    vision.set("user_enriched", true);
    vision.set("auth_service_success", authData.status === "fulfilled");
    vision.set("analytics_service_success", analytics.status === "fulfilled");

    return enrichedUser;
  } catch (error) {
    vision.set("user_lookup_failed", true);
    throw error;
  }
});

fastify.post("/api/users", async (request, reply) => {
  const userData = request.body as any;

  vision.set("operation", "create_user");
  vision.set("service_operation", "user_creation");

  try {
    // Validate user data
    vision.set("step", "validation");
    await validateUserData(userData);

    // Create user in database
    vision.set("step", "database_creation");
    const newUser = await createUserInDatabase(userData);

    // Initialize user in auth service
    vision.set("step", "auth_service_init");
    try {
      await callAuthService("POST", "/users", request as any, {
        userId: newUser.id,
        email: newUser.email,
        role: userData.role || "user",
      });
      vision.set("auth_service_initialized", true);
    } catch (authError) {
      vision.set("auth_service_failed", true);
      // Continue - auth service failure shouldn't block user creation
      console.warn("Auth service initialization failed:", authError);
    }

    // Send welcome notification
    vision.set("step", "welcome_notification");
    try {
      await callNotificationService("POST", "/notifications/welcome", request as any, {
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
      });
      vision.set("welcome_notification_sent", true);
    } catch (notificationError) {
      vision.set("welcome_notification_failed", true);
      // Non-critical failure
      console.warn("Welcome notification failed:", notificationError);
    }

    vision.set("user_created", true);
    vision.set("new_user_id", newUser.id);

    return reply.status(201).send(newUser);
  } catch (error) {
    vision.set("user_creation_failed", true);
    throw error;
  }
});

// Complex business operation involving multiple services
fastify.post("/api/users/:id/premium-upgrade", async (request, reply) => {
  const { id } = request.params as { id: string };
  const upgradeData = request.body as any;

  vision.set("operation", "premium_upgrade");
  vision.set("user_id", id);
  vision.set("upgrade_plan", upgradeData.plan);

  try {
    // Step 1: Validate user exists and is eligible
    vision.set("step", "eligibility_check");
    const user = await getUserFromDatabase(id);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    if (user.subscription === "premium") {
      vision.set("already_premium", true);
      return reply.status(409).send({ error: "User already has premium subscription" });
    }

    // Step 2: Process payment
    vision.set("step", "payment_processing");
    const paymentResult = await callPaymentService("POST", "/charges", request as any, {
      userId: id,
      amount: upgradeData.amount,
      currency: upgradeData.currency || "USD",
      plan: upgradeData.plan,
      paymentMethod: upgradeData.paymentMethod,
    });

    vision.set("payment_processed", true);
    vision.set("payment_id", paymentResult.paymentId);
    vision.set("amount_charged", paymentResult.amount);

    // Step 3: Update user subscription in database
    vision.set("step", "subscription_update");
    const updatedUser = await updateUserSubscription(id, {
      subscription: "premium",
      plan: upgradeData.plan,
      paymentId: paymentResult.paymentId,
      upgradeDate: new Date().toISOString(),
    });

    // Step 4: Update permissions in auth service
    vision.set("step", "permission_update");
    await callAuthService("PUT", `/users/${id}/permissions`, request as any, {
      role: "premium_user",
      permissions: ["premium:read", "premium:write", "premium:analytics"],
    });

    // Step 5: Send upgrade confirmation
    vision.set("step", "upgrade_notification");
    await callNotificationService("POST", "/notifications/upgrade-success", request as any, {
      userId: id,
      email: user.email,
      plan: upgradeData.plan,
      paymentId: paymentResult.paymentId,
    });

    // Step 6: Track in analytics
    vision.set("step", "analytics_tracking");
    await callAnalyticsService("POST", "/events", request as any, {
      eventType: "premium_upgrade",
      userId: id,
      plan: upgradeData.plan,
      amount: paymentResult.amount,
      timestamp: new Date().toISOString(),
    });

    vision.set("premium_upgrade_completed", true);
    vision.set("total_services_called", 4);

    return {
      success: true,
      user: updatedUser,
      payment: {
        id: paymentResult.paymentId,
        amount: paymentResult.amount,
      },
      message: "Successfully upgraded to premium",
    };
  } catch (error) {
    vision.set("premium_upgrade_failed", true);
    vision.set("failure_step", (error as any).step || "unknown");

    // Implement compensation logic for partial failures
    if ((error as any).step === "payment_processing") {
      vision.set("compensation_needed", false);
    } else if ((error as any).paymentProcessed) {
      vision.set("compensation_needed", true);
      // In real system, trigger payment reversal
      console.error("Payment processed but upgrade failed - compensation needed");
    }

    throw error;
  }
});

// Health check endpoint
fastify.get("/health", async () => {
  const healthStatus = await checkServiceHealth();

  return {
    status: healthStatus.healthy ? "healthy" : "degraded",
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    dependencies: healthStatus.dependencies,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };
});

// Service discovery endpoint
fastify.get("/service-info", async () => {
  return {
    name: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: process.env.NODE_ENV || "development",
    port: PORT,
    endpoints: [
      "GET /api/users/:id",
      "POST /api/users",
      "POST /api/users/:id/premium-upgrade",
      "GET /health",
      "GET /service-info",
    ],
    dependencies: Object.keys(SERVICES),
  };
});

// Helper functions for service communication
async function callAuthService(method: string, path: string, request: FastifyRequest, body?: any) {
  return callExternalService("auth-service", SERVICES.AUTH_SERVICE, method, path, request, body);
}

async function callNotificationService(
  method: string,
  path: string,
  request: FastifyRequest,
  body?: any,
) {
  return callExternalService(
    "notification-service",
    SERVICES.NOTIFICATION_SERVICE,
    method,
    path,
    request,
    body,
  );
}

async function callAnalyticsService(
  method: string,
  path: string,
  request: FastifyRequest,
  body?: any,
) {
  return callExternalService(
    "analytics-service",
    SERVICES.ANALYTICS_SERVICE,
    method,
    path,
    request,
    body,
  );
}

async function callPaymentService(
  method: string,
  path: string,
  request: FastifyRequest,
  body?: any,
) {
  return callExternalService(
    "payment-service",
    SERVICES.PAYMENT_SERVICE,
    method,
    path,
    request,
    body,
  );
}

async function callExternalService(
  serviceName: string,
  baseUrl: string,
  method: string,
  path: string,
  request: FastifyRequest,
  body?: any,
) {
  const startTime = Date.now();

  // Check circuit breaker
  const circuitState = getCircuitBreakerState(serviceName);
  if (circuitState === "open") {
    const error = new Error(`Circuit breaker open for ${serviceName}`) as any;
    error.circuitBreakerState = "open";
    error.upstreamService = serviceName;
    throw error;
  }

  try {
    vision.set(`${serviceName}_call_start`, Date.now());

    // Propagate service mesh headers
    const headers: Record<string, string> = {
      "X-Correlation-ID": (request as any).correlationId,
      "X-Service-Chain": (request as any).serviceChain,
      "X-Service-Name": SERVICE_NAME,
      "X-Service-Version": SERVICE_VERSION,
      "Content-Type": "application/json",
    };

    // Simulate HTTP call (in real world, use fetch or axios)
    const response = await simulateHttpCall(baseUrl + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;
    vision.set(`${serviceName}_call_duration`, duration);
    vision.set(`${serviceName}_call_success`, true);

    // Reset circuit breaker on success
    resetCircuitBreaker(serviceName);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    vision.set(`${serviceName}_call_duration`, duration);
    vision.set(`${serviceName}_call_failed`, true);
    vision.set(`${serviceName}_error`, (error as Error).message);

    // Update circuit breaker
    recordServiceFailure(serviceName);

    const serviceError = error as any;
    serviceError.upstreamService = serviceName;
    serviceError.circuitBreakerState = getCircuitBreakerState(serviceName);

    throw serviceError;
  }
}

// Circuit breaker implementation
function getCircuitBreakerState(serviceName: string): "closed" | "open" | "half-open" {
  const breaker = circuitBreakers.get(serviceName);
  if (!breaker) return "closed";

  const now = Date.now();
  const timeSinceLastFailure = now - breaker.lastFailure;

  if (breaker.state === "open" && timeSinceLastFailure > 30000) {
    // 30 seconds
    breaker.state = "half-open";
    return "half-open";
  }

  return breaker.state;
}

function recordServiceFailure(serviceName: string) {
  const breaker = circuitBreakers.get(serviceName) || {
    failures: 0,
    lastFailure: 0,
    state: "closed" as const,
  };

  breaker.failures++;
  breaker.lastFailure = Date.now();

  // Open circuit after 5 failures
  if (breaker.failures >= 5) {
    breaker.state = "open";
    console.warn(`Circuit breaker opened for ${serviceName} after ${breaker.failures} failures`);
  }

  circuitBreakers.set(serviceName, breaker);
}

function resetCircuitBreaker(serviceName: string) {
  const breaker = circuitBreakers.get(serviceName);
  if (breaker) {
    breaker.failures = 0;
    breaker.state = "closed";
    circuitBreakers.set(serviceName, breaker);
  }
}

// Mock implementations
async function simulateHttpCall(url: string, options: any) {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));

  // Simulate occasional failures
  if (Math.random() < 0.05) {
    // 5% failure rate
    throw new Error(`Service call failed: ${url}`);
  }

  // Return mock responses based on URL
  if (url.includes("/users/") && url.includes("/permissions")) {
    return { permissions: ["read:profile", "write:profile"] };
  }

  if (url.includes("/users/") && url.includes("/stats")) {
    return {
      loginCount: Math.floor(Math.random() * 100),
      lastLogin: new Date().toISOString(),
    };
  }

  if (url.includes("/charges")) {
    return {
      paymentId: `pay_${Date.now()}`,
      amount: 2999,
      status: "succeeded",
    };
  }

  return { success: true, timestamp: Date.now() };
}

async function getUserFromDatabase(id: string) {
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (id === "404") return null;

  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    subscription: "free",
    createdAt: new Date().toISOString(),
  };
}

async function createUserInDatabase(userData: any) {
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    id: `user_${Date.now()}`,
    name: userData.name,
    email: userData.email,
    subscription: "free",
    createdAt: new Date().toISOString(),
  };
}

async function updateUserSubscription(id: string, updates: any) {
  await new Promise((resolve) => setTimeout(resolve, 80));

  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

async function validateUserData(userData: any) {
  if (!userData.name || !userData.email) {
    throw new Error("Name and email are required");
  }
}

async function checkServiceHealth() {
  const dependencies = {};

  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      await simulateHttpCall(`${url}/health`, { method: "GET" });
      dependencies[name] = "healthy";
    } catch {
      dependencies[name] = "unhealthy";
    }
  }

  const healthyCount = Object.values(dependencies).filter((status) => status === "healthy").length;
  const totalCount = Object.keys(dependencies).length;

  return {
    healthy: healthyCount === totalCount,
    dependencies,
  };
}

function generateCorrelationId(): string {
  return `${SERVICE_NAME}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(
      `🚀 Microservice "${SERVICE_NAME}" v${SERVICE_VERSION} is running on http://localhost:${PORT}`,
    );
    console.log("");
    console.log("🔗 Microservice endpoints:");
    console.log("  GET /api/users/123 - Get user with service enrichment");
    console.log(
      '  POST /api/users - Create user (JSON: {"name": "Test", "email": "test@example.com"})',
    );
    console.log("  POST /api/users/123/premium-upgrade - Complex multi-service operation");
    console.log("  GET /health - Service health check");
    console.log("  GET /service-info - Service discovery information");
    console.log("");
    console.log("🔍 Add these headers for distributed tracing:");
    console.log("  X-Correlation-ID: your-correlation-id");
    console.log("  X-Service-Chain: previous-service");
    console.log("  X-Request-ID: your-request-id");
    console.log("");
    console.log("⚡ Features demonstrated:");
    console.log("  - Service mesh header propagation");
    console.log("  - Circuit breaker pattern");
    console.log("  - Distributed tracing with Vision");
    console.log("  - Multi-service transactions");
    console.log("  - Error compensation patterns");
    console.log("  - Health checks and service discovery");
    console.log("");
    console.log("📊 Watch the console for distributed tracing output!");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
