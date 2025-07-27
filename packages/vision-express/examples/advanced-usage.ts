import express from "express";
import { vision } from "@rodrigopsasaki/vision";
import { visionMiddleware, type VisionRequest } from "../src/middleware";

// Initialize Vision with comprehensive exporters
vision.init({
  exporters: [
    {
      name: "console",
      success: (ctx) => {
        const duration = Date.now() - new Date(ctx.timestamp).getTime();
        console.log(`✅ [${ctx.id}] ${ctx.name} completed in ${duration}ms`);
        console.log("   Data:", Object.fromEntries(ctx.data));
      },
      error: (ctx, err) => {
        console.error(`❌ [${ctx.id}] ${ctx.name} failed:`, err);
        console.error("   Context:", Object.fromEntries(ctx.data));
      },
    },
  ],
});

const app = express();

// Add JSON body parsing
app.use(express.json());

// Add the Vision middleware with custom configuration
app.use(visionMiddleware({
  // Enable body capture for this example
  captureBody: true,
  
  // Exclude additional routes
  excludeRoutes: ["/health", "/metrics", "/status", "/static", "/favicon.ico"],
  
  // Custom user extraction
  extractUser: (req) => (req as any).user || req.headers["x-user-id"],
  
  // Custom correlation ID headers
  correlationIdHeaders: ["x-correlation-id", "x-request-id", "x-trace-id"],
  
  // Additional security redaction
  redactHeaders: [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
    "x-session-token",
    "x-csrf-token"
  ],
  redactQueryParams: ["token", "key", "secret", "password", "auth"],
  redactBodyFields: ["password", "ssn", "credit_card", "secret", "api_key"],
}));

// Example routes with proper TypeScript types
app.get("/users/:id", async (req: VisionRequest, res) => {
  // Access the Vision context
  const ctx = req.visionContext;
  console.log(`Processing request ${ctx?.id} for user ${req.params.id}`);
  
  // Add structured data to the context
  vision.set("user_id", req.params.id);
  vision.set("operation", "get_user");
  vision.set("timestamp", new Date().toISOString());
  
  // Add request metadata
  vision.merge("request", {
    method: req.method,
    path: req.path,
    query: req.query,
    params: req.params,
  });
  
  // Track events
  vision.push("events", "user_lookup_started");
  
  try {
    // Simulate database lookup
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const user = {
      id: req.params.id,
      name: "John Doe",
      email: "john@example.com",
      created_at: new Date().toISOString(),
    };
    
    vision.push("events", "user_lookup_completed");
    vision.set("result_count", 1);
    vision.set("user_found", true);
    
    res.json(user);
  } catch (error) {
    vision.push("events", "user_lookup_failed");
    vision.set("error_type", "database_error");
    vision.set("user_found", false);
    throw error;
  }
});

app.post("/users", async (req: VisionRequest, res) => {
  vision.set("operation", "create_user");
  vision.set("user_data", req.body);
  
  // Track the creation process
  vision.push("events", "user_creation_started");
  
  try {
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (!req.body.name || !req.body.email) {
      vision.set("error_type", "validation_error");
      vision.set("validation_errors", ["name and email are required"]);
      return res.status(400).json({ error: "Name and email are required" });
    }
    
    // Simulate database insertion
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const newUser = {
      id: `user_${Date.now()}`,
      ...req.body,
      created_at: new Date().toISOString(),
    };
    
    vision.push("events", "user_creation_completed");
    vision.set("result_count", 1);
    vision.set("user_created", true);
    
    res.status(201).json(newUser);
  } catch (error) {
    vision.push("events", "user_creation_failed");
    vision.set("error_type", "database_error");
    vision.set("user_created", false);
    throw error;
  }
});

app.put("/users/:id", async (req: VisionRequest, res) => {
  vision.set("user_id", req.params.id);
  vision.set("operation", "update_user");
  vision.set("update_data", req.body);
  
  vision.push("events", "user_update_started");
  
  try {
    // Simulate database update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const updatedUser = {
      id: req.params.id,
      ...req.body,
      updated_at: new Date().toISOString(),
    };
    
    vision.push("events", "user_update_completed");
    vision.set("result_count", 1);
    vision.set("user_updated", true);
    
    res.json(updatedUser);
  } catch (error) {
    vision.push("events", "user_update_failed");
    vision.set("error_type", "database_error");
    vision.set("user_updated", false);
    throw error;
  }
});

app.delete("/users/:id", async (req: VisionRequest, res) => {
  vision.set("user_id", req.params.id);
  vision.set("operation", "delete_user");
  
  vision.push("events", "user_deletion_started");
  
  try {
    // Simulate database deletion
    await new Promise(resolve => setTimeout(resolve, 80));
    
    vision.push("events", "user_deletion_completed");
    vision.set("result_count", 1);
    vision.set("user_deleted", true);
    
    res.status(204).send();
  } catch (error) {
    vision.push("events", "user_deletion_failed");
    vision.set("error_type", "database_error");
    vision.set("user_deleted", false);
    throw error;
  }
});

// Error handling example
app.get("/error", (req: VisionRequest, res) => {
  vision.set("operation", "trigger_error");
  vision.set("error_intentional", true);
  
  // This error will be captured by Vision
  throw new Error("Something went wrong!");
});

// Health check (excluded from Vision tracking)
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Metrics endpoint (excluded from Vision tracking)
app.get("/metrics", (req, res) => {
  res.json({
    requests: 0,
    errors: 0,
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Advanced Vision Express server running on http://localhost:${PORT}`);
  console.log("📊 Vision middleware is active with custom configuration");
  console.log("");
  console.log("Available endpoints:");
  console.log(`  GET    http://localhost:${PORT}/users/:id`);
  console.log(`  POST   http://localhost:${PORT}/users`);
  console.log(`  PUT    http://localhost:${PORT}/users/:id`);
  console.log(`  DELETE http://localhost:${PORT}/users/:id`);
  console.log(`  GET    http://localhost:${PORT}/error (triggers error)`);
  console.log(`  GET    http://localhost:${PORT}/health (excluded from tracking)`);
  console.log(`  GET    http://localhost:${PORT}/metrics (excluded from tracking)`);
  console.log("");
  console.log("Try adding headers like:");
  console.log("  X-Correlation-ID: your-correlation-id");
  console.log("  X-Request-ID: your-request-id");
  console.log("  X-User-ID: your-user-id");
}); 