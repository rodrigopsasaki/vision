import express from "express";
import { vision } from "@rodrigopsasaki/vision";
import { createVisionMiddleware } from "../src/middleware";

// Initialize Vision with a simple console exporter
vision.init({
  exporters: [
    {
      name: "console",
      success: (ctx) => {
        console.log("✅ Request completed:", {
          id: ctx.id,
          name: ctx.name,
          duration: Date.now() - new Date(ctx.timestamp).getTime(),
          data: Object.fromEntries(ctx.data),
        });
      },
      error: (ctx, err) => {
        console.error("❌ Request failed:", {
          id: ctx.id,
          name: ctx.name,
          error: err,
          data: Object.fromEntries(ctx.data),
        });
      },
    },
  ],
});

const app = express();

// Add the Vision middleware
app.use(createVisionMiddleware());

// Example routes
app.get("/users/:id", async (req, res) => {
  // Add custom data to the context
  vision.set("user_id", req.params.id);
  vision.set("operation", "get_user");
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Add more context data
  vision.set("result_count", 1);
  vision.merge("metadata", {
    service: "user-service",
    version: "1.0.0",
  });
  
  res.json({ id: req.params.id, name: "John Doe" });
});

app.post("/users", async (req, res) => {
  vision.set("operation", "create_user");
  vision.set("user_data", req.body);
  
  // Simulate database operation
  await new Promise(resolve => setTimeout(resolve, 200));
  
  res.status(201).json({ id: "new-user-123", ...req.body });
});

app.get("/health", (req, res) => {
  // This route will be excluded from Vision tracking by default
  res.json({ status: "ok" });
});

// Error handling example
app.get("/error", (req, res) => {
  vision.set("operation", "trigger_error");
  
  // This error will be captured by Vision
  throw new Error("Something went wrong!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("📊 Vision middleware is active - check the console for request logs");
  console.log("");
  console.log("Try these endpoints:");
  console.log(`  GET  http://localhost:${PORT}/users/123`);
  console.log(`  POST http://localhost:${PORT}/users (with JSON body)`);
  console.log(`  GET  http://localhost:${PORT}/error`);
  console.log(`  GET  http://localhost:${PORT}/health (excluded from tracking)`);
}); 