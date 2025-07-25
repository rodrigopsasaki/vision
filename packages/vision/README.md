![CI](https://github.com/rodrigopsasaki/vision/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/github/license/rodrigopsasaki/vision)
![Version](https://img.shields.io/npm/v/@rodrigopsasaki/vision.svg)
![Downloads](https://img.shields.io/npm/dm/@rodrigopsasaki/vision.svg)
![Install size](https://packagephobia.com/badge?p=@rodrigopsasaki/vision)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)
![Coverage](https://img.shields.io/badge/Coverage-Coming--Soon-yellow)
![Open Issues](https://img.shields.io/github/issues/rodrigopsasaki/vision)

# vision

> Structured observability, modeled around intent — not output.

---

## You don’t need more logs, you need context.

You need to know:

- What just happened
- What data was involved
- What the outcome was

But most systems log like this:

---

### Three stages of observability

Let’s say you’re processing a shopping cart.

#### 1. Naive logging

```ts
console.log("starting cart job");
console.log("loaded cart", cart.id);
console.log("charging", cart.total);
console.log("done", { status: "ok" });
```

This tells a story — but it’s whispering.
No IDs. No continuity. Just bursts of text into the void.
Now imagine billions of these.
Good luck finding the one you care about.

---

#### 2. Disciplined logging

```ts
console.log("start", { user_id, correlation_id });
console.log("loaded cart", { cart_id, correlation_id });
console.log("charging", { amount, correlation_id });
console.log("done", { cart_id, status }); // <-- whoops, no user_id, no correlation_id
```

You’re trying. You’re threading a `correlation_id`.
You’re passing `user_id` everywhere manually.
Until someone forgets. And now that one log line is invisible.

---

#### 3. Structured context with Vision

```ts
await vision.observe("cart.process", async () => {
  vision.set("user_id", userId);
  vision.set("correlation_id", req.headers["x-correlation-id"]);

  const cart = await db.getCart(userId);
  vision.set("cart_id", cart.id);

  const result = await chargeCard(cart);
  vision.set("charge_status", result.status);

  await sendConfirmation(userId);
  vision.set("confirmation", "sent");
});
```

Now everything lives in a scoped context.
No repetition. No missing keys.
Just a clean canonical event:

```json
{
  "name": "cart.process",
  "timestamp": "...",
  "data": {
    "user_id": "u123",
    "correlation_id": "abc-456",
    "cart_id": "c789",
    "charge_status": "success",
    "confirmation": "sent"
  }
}
```

---

## Real-world usage

Vision is meant to disappear into your system. Here's what it looks like in real code:

```ts
await vision.observe("order.fulfillment", async () => {
  vision.set("user_id", user.id);
  vision.set("order_id", order.id);

  await fulfillOrder(order);
});
```

```ts
// fulfillment.ts
import { vision } from "@rodrigopsasaki/vision";

export async function fulfillOrder(order) {
  await pickItems(order);
  await packItems(order);
  await shipOrder(order);
}

async function pickItems(order) {
  // ...picking logic...
  vision.push("events", "picked");
}

async function packItems(order) {
  // ...packing logic...
  vision.push("events", "packed");
  vision.merge("dimensions", { weight: "2.1kg" }); // replaces a log line
}

async function shipOrder(order) {
  // ...shipping logic...
  vision.push("events", "shipped");
  vision.merge("shipment", {
    carrier: "DHL",
    tracking: "abc123",
  });
}
```

You don’t pass context around.
You don’t log manually.
You just describe what happened.

Vision collects it — then emits exactly one event.

---

## Install

```bash
npm add @rodrigopsasaki/vision
```

---

## Quick start

You don’t need to configure anything to start using Vision.

```ts
import { vision } from "@rodrigopsasaki/vision";

await vision.observe("my.workflow", async () => {
  vision.set("step", "one");
  vision.set("status", "ok");
});
```

That’s it.
No setup. No boilerplate. No `init()` call required.
Vision runs with a default console exporter out of the box.

When you're ready to customize behavior — like sending events to Datadog or disabling console logs — you can call `vision.init()` to register your own exporters.

---

## Working with context

Vision gives you a few simple tools:

```ts
vision.set("foo", "bar");
vision.get("foo"); // "bar"

vision.push("tags", "new");
vision.push("tags", "priority");

vision.merge("meta", { version: "1.2.3" });
vision.merge("meta", { region: "us-east-1" });
```

Everything you set is scoped to the active `observe()` block.
Accessing context outside that block throws — by design.

---

## You don’t need a correlation ID

Most systems bolt on `correlation_id` to make up for lost context.
Vision doesn’t lose context in the first place.

You don’t thread a request ID.
You don’t decorate every log call.
You just enter an `observe()` block — and Vision handles the scope.

Want to tag with a trace ID from upstream? Do it once:

```ts
await vision.observe("http.request", async () => {
  vision.set("trace_id", req.headers["x-trace-id"]);
  // do work
});
```

You get a unique ID for free.
But you won’t need it to hold everything together anymore.

---

## Controlling output

By default, Vision logs a single event to the console.
But you can register your own exporters.

### Add exporters

Exporters are side-effect hooks that run at the end of a context — on success or error.

```ts
vision.registerExporter({
  name: "datadog",
  success: (ctx) => sendToDatadog(ctx),
  error: (ctx, err) => sendErrorToDatadog(ctx, err),
});
```

If you skip `error()`, Vision falls back to `success()` even on failure — so you’ll still get the data.

---

### Customize at startup

You can register exporters when you initialize:

```ts
vision.init({
  exporters: [
    {
      name: "stdout",
      success: (ctx) => {
        console.log("event:", ctx.name, Object.fromEntries(ctx.data.entries()));
      },
    },
  ],
});
```

You can also remove exporters later:

```ts
vision.unregisterExporter("stdout");
```

For now, the default console exporter can’t be removed — but we’ll probably support that soon.

---

## Exporter Lifecycle Hooks

Exporters can optionally provide lifecycle hooks to wrap execution with custom logic. These hooks are purpose-built for observability systems.

### Lifecycle Hooks Basics

Exporters can use lifecycle hooks to:
- Set up their own context before execution (e.g., Datadog spans, OpenTelemetry traces)
- Clean up or finalize after successful execution
- Handle error-specific cleanup when execution fails
- Still receive the final context data for export

```ts
const myExporter: VisionExporter = {
  name: "my-exporter",
  
  before: (ctx: VisionContext) => {
    // Set up your custom context here
    const span = tracer.startSpan(ctx.name);
    ctx.data.set("my.span", span);
  },
  
  after: (ctx: VisionContext) => {
    // Clean up after successful execution
    const span = ctx.data.get("my.span") as any;
    if (span) {
      span.finish();
      ctx.data.delete("my.span");
    }
  },
  
  onError: (ctx: VisionContext, err: unknown) => {
    // Handle error-specific cleanup
    const span = ctx.data.get("my.span") as any;
    if (span) {
      span.tags.error = err instanceof Error ? err.message : String(err);
      span.finish();
      ctx.data.delete("my.span");
    }
  },
  
  success: (ctx: VisionContext) => {
    // Export the final context data
    console.log("Success:", ctx);
  },
};
```

### Lifecycle Hook Execution Order

1. **Before Phase**: All exporter `before()` hooks are called in registration order
2. **Execution**: The main callback function runs
3. **After Phase**: If successful, all exporter `after()` hooks are called in registration order
4. **OnError Phase**: If failed, all exporter `onError()` hooks are called in registration order
5. **Export**: All exporter `success()` or `error()` functions are called

### Real-world Example: Datadog Integration

```ts
import { vision } from "@rodrigopsasaki/vision";

const datadogExporter: VisionExporter = {
  name: "datadog",
  
  before: (ctx: VisionContext) => {
    // Create a Datadog span with vision context info
    const span = tracer.startSpan(ctx.name, {
      "vision.id": ctx.id,
      "vision.scope": ctx.scope || "unknown",
      "vision.source": ctx.source || "unknown",
    });
    
    // Store span in context for later cleanup
    ctx.data.set("datadog.span", span);
  },
  
  after: (ctx: VisionContext) => {
    // Finish span on successful completion
    const span = ctx.data.get("datadog.span") as any;
    if (span) {
      span.finish();
      ctx.data.delete("datadog.span");
    }
  },
  
  onError: (ctx: VisionContext, err: unknown) => {
    // Finish span with error information
    const span = ctx.data.get("datadog.span") as any;
    if (span) {
      span.tags.error = err instanceof Error ? err.message : String(err);
      span.finish();
      ctx.data.delete("datadog.span");
    }
  },
  
  success: (ctx: VisionContext) => {
    // Send metrics to Datadog
    sendMetrics(ctx.name, Object.fromEntries(ctx.data.entries()));
  },
  
  error: (ctx: VisionContext, err: unknown) => {
    // Send error metrics to Datadog
    sendErrorMetrics(ctx.name, err);
  },
};

// Register the exporter
vision.init({
  exporters: [datadogExporter],
});

// Now every observe() call creates a Datadog span automatically
await vision.observe("order.processing", async () => {
  vision.set("user_id", "user123");
  // ... work happens ...
});
```

### Error Handling

Lifecycle hooks are executed appropriately based on the execution outcome. Error handling is declarative and clear:

```ts
const exporter: VisionExporter = {
  name: "error-handling",
  
  before: (ctx: VisionContext) => {
    console.log("Setting up...");
  },
  
  after: (ctx: VisionContext) => {
    console.log("Cleaning up after success...");
  },
  
  onError: (ctx: VisionContext, err: unknown) => {
    console.log("Cleaning up after error:", err);
  },
  
  success: (ctx: VisionContext) => {
    console.log("Success!");
  },
};
```

---

## Philosophy

Vision replaces many logs with one idea:

> “This happened. Here's everything we know.”

It’s not a log formatter.
It’s a structured, observable boundary.

You stop logging every heartbeat.
You start capturing truth.

## ⚖️ License

MIT © [Rodrigo Sasaki](https://github.com/rodrigopsasaki)
