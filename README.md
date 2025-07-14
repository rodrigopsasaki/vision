# Vision

This is the monorepo for `@rodrigopsasaki/vision` — a structured observability system for Node.js applications.

Vision helps you capture **one story** across **many layers** of execution. One request. One bag of context. Zero clutter.

---

## ✨ What is Vision?

Vision is a runtime context system built on top of `AsyncLocalStorage`. It lets you annotate execution with structured metadata — user IDs, session tokens, product SKUs, request IDs — and access that context anywhere, without passing it around manually.

It works across:

- HTTP requests
- Background jobs
- Message consumers
- Nested async flows

All of them can contribute to — and read from — the same shared context.

---

## 🧠 Why does this matter?

Most observability setups ask you to thread metadata manually:

```ts
logger.info("ItemAddedToCart", { userId, sessionId, ... })
```

That’s fine... until you realize every log line now depends on every function upstream to pass those values around correctly.

Vision flips that model:

- **You set metadata once**
- **Vision collects it into a shared context**
- **Exporters emit it however you like**

This lets you write clean business logic — and still get perfect logs, metrics, and traces.

---

## 🔁 Static Aggregation Across Layers

Imagine a user browsing your store, adding items to their cart. You record events in multiple layers:

- The HTTP handler gets the session token
- The product service knows the SKU
- The cart service emits the event

Each one adds what it knows. Vision merges it.

### Without Vision

```ts
// API layer
addToCart({ userId, sessionId, sku })

// Cart service
function addToCart({ userId, sessionId, sku }) {
  logger.info("ItemAddedToCart", {
    userId,
    sessionId,
    sku,
  })
}
```

Everything depends on the call site. If you forget to pass a value, your telemetry silently breaks.

---

### With Vision

```ts
// API layer
withVision(() => {
  vision.set("userId", "u-123")
  vision.set("sessionId", "sess-456")

  cart.addToCart({ sku: "sku-789" })
})
```

```ts
// Cart service
function addToCart({ sku }) {
  vision.set("sku", sku)
  logger.info("ItemAddedToCart") // All context is already there
}
```

You get:

```json
{
  "event": "ItemAddedToCart",
  "userId": "u-123",
  "sessionId": "sess-456",
  "sku": "sku-789"
}
```

No boilerplate. No global variables. No missing metadata. You just write normal code — Vision does the stitching.

---

## 📦 Packages

| Package                                       | Description                                                |
| --------------------------------------------- | ---------------------------------------------------------- |
| [`@rodrigopsasaki/vision`](./packages/vision) | Canonical context and structured observability for Node.js |

---

## 🔌 Why Exporters?

Most logging libraries couple aggregation and emission. That’s limiting.

Vision separates them:

- **Aggregation**: done statically via context
- **Emission**: done by plug-and-play exporters

This gives you real leverage:

- ✅ Log once, emit to many places (console, OTEL, vendor APIs)
- ✅ Add new destinations without touching your app
- ✅ Silence all output in tests, without mocks
- ✅ Swap vendors without rewriting instrumentation

Exporters are just functions. Vision gives them the context. You control the rest.

---

## 🧪 Testable by Default

Vision makes observability test-friendly. No more stubbing global loggers.

```ts
withVision(() => {
  vision.set("userId", "test-user")
  cart.addToCart({ sku: "sku-xyz" })

  expect(myFakeExporter).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "test-user", sku: "sku-xyz" }),
  )
})
```

The whole context is scoped, inspectable, and composable.

---

## 🧰 Tooling

- **Monorepo:** [Turborepo](https://turbo.build)
- **Package manager:** [pnpm](https://pnpm.io)
- **Build system:** [tsup](https://tsup.egoist.dev)
- **Testing:** [Vitest](https://vitest.dev)

---

## 🛠️ Getting Started

Install dependencies:

```bash
pnpm install
```

Build all packages:

```bash
turbo run build
```

Run tests:

```bash
turbo run test
```

---

## 💡 Philosophy

Vision is a straightforward idea: carry context through your program in a consistent, structured way.

It’s inspired by Go’s [`context.Context`](https://pkg.go.dev/context) — a simple, powerful mechanism that lets you pass metadata implicitly through your application, enriching it as you go. It’s not new, and it’s not mine. But it works. Really well.

JavaScript now has the tools to support something similar. With `AsyncLocalStorage`, we can capture context across async boundaries without manually threading values through every call.

Vision builds on that — no magic, no reinvention — to offer a practical, pluggable context system for the Node.js world.

The goal is clarity:

- Set metadata once, anywhere in the stack
- Read it anywhere else, without ceremony
- Export it however you need: logs, traces, metrics, or your own systems

Good context makes observability easier.
Good defaults make context easier.
That’s all this is.

## ⚖️ License

MIT © [Rodrigo Sasaki](https://github.com/rodrigopsasaki)
