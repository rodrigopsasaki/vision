![CI](https://github.com/rodrigopsasaki/vision/actions/workflows/checks.yml/badge.svg)
![License](https://img.shields.io/github/license/rodrigopsasaki/vision)
![Version](https://img.shields.io/npm/v/@rodrigopsasaki/vision.svg)
![Downloads](https://img.shields.io/npm/dm/@rodrigopsasaki/vision.svg)
![Install size](https://packagephobia.com/badge?p=@rodrigopsasaki/vision)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)
![Coverage](https://img.shields.io/badge/Coverage-Coming--Soon-yellow)
![Open Issues](https://img.shields.io/github/issues/rodrigopsasaki/vision)

# vision

**Structured observability. Context-aware. Exportable anywhere.**

`vision` is a minimal runtime context system built on `AsyncLocalStorage`, designed to collect structured metadata across async calls and export it wherever you need — logs, telemetry, debugging, or beyond.

---

## ✨ Features

- 📦 Lightweight: no runtime deps
- 🧠 Context-aware: built on `AsyncLocalStorage`
- 🔁 Fully async-safe: works across `await`, `Promise.then`, and nested scopes
- 🧰 Extensible: pluggable exporters (e.g., for Pino, Winston, OTEL)
- 🧪 Dead simple to test

---

## 🚀 Quick Start

Install:

```bash
npm add @rodrigopsasaki/vision
```

Wrap your unit of work:

```ts
import { vision } from "@rodrigopsasaki/vision"

await vision.with("flag-check", async () => {
  vision.set("user.id", 123)
  vision.push("flags.evaluated", { name: "boost", result: true })

  logSomething()
  vision.exportTo("logger")
})
```

---

## 🧱 API

```ts
await vision.with(name, asyncFn)
```

Starts a new isolated context. Adds metadata like `id`, `timestamp`, and `name`.

```ts
vision.set("key", value)
```

Stores a scalar or object. Overwrites existing value.

```ts
vision.get("key")
```

Retrieves a value. Throws if called outside `vision.with()`.

```ts
vision.push("key", value)
```

Appends to a list. Creates a list if needed. Overwrites non-lists.

```ts
vision.merge("key", value)
```

Merges into a map. Creates map if needed. Overwrites non-maps.

```ts
vision.context()
```

Returns the current `VisionContext`, including `.id`, `.timestamp`, and `.data` (`Map<string, unknown>`).

```ts
vision.registerExporter("name", fn)
vision.exportTo("name")
```

Registers and invokes an exporter with the current context.

---

## 🔌 Logger Integration

Works with any logger. Example: **Pino**:

```ts
const logger = pino({
  bindings() {
    return Object.fromEntries(vision.context().data)
  },
})
```

Or **Winston**:

```ts
const enrich = winston.format((info) => {
  Object.assign(info, Object.fromEntries(vision.context().data))
  return info
})
```

---

## 🧪 Testing

All vision APIs are fully testable and isolated per `vision.with()` scope.

Run tests with:

```bash
npm test
```

---

## 📋 License

MIT © [Rodrigo Sasaki](https://github.com/rodrigopsasaki)
