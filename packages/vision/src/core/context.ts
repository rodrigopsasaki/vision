import { getContextStore } from "./global";
import type { VisionContext } from "./types";

/**
 * Retrieves the current active vision context.
 * 
 * This function returns the vision context that is currently active in the
 * async execution scope. It's useful for accessing context metadata or
 * for advanced use cases where you need direct access to the context object.
 * 
 * @returns The current active vision context
 * @throws {Error} If called outside of a vision context scope
 * 
 * @example
 * ```typescript
 * await vision.observe("my.workflow", async () => {
 *   const ctx = getContext();
 *   console.log("Working in context:", ctx.name);
 *   console.log("Context ID:", ctx.id);
 * });
 * ```
 */
export function getContext(): VisionContext {
  const context = getContextStore().getStore();
  if (!context) {
    throw new Error("No active vision context");
  }
  return context;
}

/**
 * Sets a key-value pair on the current vision context's data map.
 * 
 * This is the primary method for storing data in the current vision context.
 * The data will be automatically exported when the context completes.
 * 
 * @param key - The key to store the value under
 * @param value - The value to store (can be any type)
 * 
 * @example
 * ```typescript
 * await vision.observe("user.login", async () => {
 *   visionSet("user_id", "user123");
 *   visionSet("login_method", "oauth");
 *   visionSet("timestamp", new Date().toISOString());
 * });
 * ```
 */
export function visionSet<K extends string, V = unknown>(key: K, value: V): void {
  getContext().data.set(key, value);
}

/**
 * Retrieves a value from the current vision context's data map.
 * 
 * @param key - The key to retrieve
 * @returns The stored value or undefined if not found
 * 
 * @example
 * ```typescript
 * await vision.observe("order.processing", async () => {
 *   visionSet("order_id", "order123");
 *   
 *   // Later in the same context...
 *   const orderId = visionGet("order_id"); // "order123"
 *   const missing = visionGet("nonexistent"); // undefined
 * });
 * ```
 */
export function visionGet<T = unknown>(key: string): T | undefined {
  return getContext().data.get(key) as T | undefined;
}

/**
 * Pushes a value into an array stored at the given key in the context's data map.
 * 
 * If the key doesn't exist yet, an empty array is created first. This is useful
 * for collecting multiple related values during context execution.
 * 
 * @param key - The key for the array
 * @param value - The value to push to the array
 * 
 * @example
 * ```typescript
 * await vision.observe("order.processing", async () => {
 *   visionPush("events", "order_created");
 *   visionPush("events", "payment_processed");
 *   visionPush("events", "inventory_updated");
 *   
 *   // Results in: ["order_created", "payment_processed", "inventory_updated"]
 * });
 * ```
 */
export function visionPush<T = unknown>(key: string, value: T): void {
  const list = (getContext().data.get(key) as T[] | undefined) ?? [];
  list.push(value);
  getContext().data.set(key, list);
}

/**
 * Merges a record into the existing object at the given key in the context's data map.
 * 
 * If the key doesn't exist yet, an empty object is created first. This is useful
 * for building up structured metadata objects incrementally.
 * 
 * @param key - The key for the object
 * @param value - The object to merge into the existing object
 * 
 * @example
 * ```typescript
 * await vision.observe("api.request", async () => {
 *   visionMerge("request", { method: "POST", path: "/users" });
 *   visionMerge("request", { headers: { "content-type": "application/json" } });
 *   visionMerge("request", { body: { name: "John" } });
 *   
 *   // Results in: {
 *   //   method: "POST",
 *   //   path: "/users", 
 *   //   headers: { "content-type": "application/json" },
 *   //   body: { name: "John" }
 *   // }
 * });
 * ```
 */
export function visionMerge<K extends string, V = unknown>(key: K, value: Record<string, V>): void {
  const existing = (getContext().data.get(key) as Record<string, V> | undefined) ?? {};
  getContext().data.set(key, { ...existing, ...value });
}
