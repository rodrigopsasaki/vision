import { getContextStore } from "./global";
import type { VisionContext } from "./types";

/**
 * Retrieves the current active vision context.
 * Throws an error if called outside of a vision context scope.
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
 */
export function visionSet<K extends string, V = unknown>(key: K, value: V): void {
  getContext().data.set(key, value);
}

/**
 * Retrieves a value from the current vision context's data map.
 */
export function visionGet<T = unknown>(key: string): T | undefined {
  return getContext().data.get(key) as T | undefined;
}

/**
 * Pushes a value into an array stored at the given key in the context's data map.
 * Initializes the array if it doesn't exist yet.
 */
export function visionPush<T = unknown>(key: string, value: T): void {
  const list = (getContext().data.get(key) as T[] | undefined) ?? [];
  list.push(value);
  getContext().data.set(key, list);
}

/**
 * Merges a record into the existing object at the given key in the context's data map.
 * Initializes the object if it doesn't exist yet.
 */
export function visionMerge<K extends string, V = unknown>(key: K, value: Record<string, V>): void {
  const existing = (getContext().data.get(key) as Record<string, V> | undefined) ?? {};
  getContext().data.set(key, { ...existing, ...value });
}
