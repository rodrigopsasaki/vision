import type { VisionContext, NormalizationConfig } from "../core/types";

import { transformMapKeys } from "./keyTransforms";

/**
 * Normalizes a Vision context according to the provided configuration.
 * 
 * This function applies key casing transformations to the context's data
 * while preserving the context's metadata (id, timestamp, name, etc.).
 * 
 * @param context - The Vision context to normalize
 * @param config - The normalization configuration
 * @returns A new normalized Vision context
 * 
 * @example
 * ```typescript
 * const context = {
 *   id: "ctx-123",
 *   name: "user.login",
 *   data: new Map([
 *     ["userId", "user123"],
 *     ["userProfile", { firstName: "John", lastName: "Doe" }]
 *   ])
 * };
 * 
 * const normalized = normalizeContext(context, {
 *   enabled: true,
 *   keyCasing: "snake_case",
 *   deep: true
 * });
 * 
 * // Result:
 * // {
 * //   id: "ctx-123",
 * //   name: "user.login", 
 * //   data: new Map([
 * //     ["user_id", "user123"],
 * //     ["user_profile", { first_name: "John", last_name: "Doe" }]
 * //   ])
 * // }
 * ```
 */
export function normalizeContext(
  context: VisionContext,
  config: NormalizationConfig,
): VisionContext {
  // If normalization is disabled, return the original context
  if (!config.enabled) {
    return context;
  }

  // Create a shallow copy of the context to avoid mutations
  const normalizedContext: VisionContext = {
    ...context,
    data: config.deep 
      ? transformMapKeys(context.data, config.keyCasing)
      : transformMapKeysShallow(context.data, config.keyCasing),
  };

  return normalizedContext;
}

/**
 * Transforms Map keys without deep transformation of values.
 * Used when deep normalization is disabled.
 * 
 * @param map - The Map to transform
 * @param style - The target casing style
 * @returns A new Map with transformed keys
 */
function transformMapKeysShallow(
  map: Map<string, unknown>, 
  style: "camelCase" | "snake_case" | "kebab-case" | "PascalCase" | "none"
): Map<string, unknown> {
  if (style === "none") {
    return map;
  }

  const transformed = new Map<string, unknown>();
  
  for (const [key, value] of map.entries()) {
    const transformedKey = transformKey(key, style);
    // Don't transform the value when deep is false
    transformed.set(transformedKey, value);
  }
  
  return transformed;
}

/**
 * Simple key transformation function for shallow normalization.
 */
function transformKey(key: string, style: "camelCase" | "snake_case" | "kebab-case" | "PascalCase" | "none"): string {
  if (style === "none") {
    return key;
  }

  // Split the key into words
  const words = splitIntoWords(key);
  
  switch (style) {
    case "camelCase":
      return words[0].toLowerCase() + words.slice(1).map(capitalize).join("");
    
    case "snake_case":
      return words.map(word => word.toLowerCase()).join("_");
    
    case "kebab-case":
      return words.map(word => word.toLowerCase()).join("-");
    
    case "PascalCase":
      return words.map(capitalize).join("");
    
    default:
      return key;
  }
}

function splitIntoWords(str: string): string[] {
  if (str.length <= 1) {
    return [str];
  }

  const parts = str.split(/[-_\s]+/).filter(Boolean);
  const words: string[] = [];
  
  for (const part of parts) {
    if (!part) continue;
    const camelCaseSplit = part.split(/(?=[A-Z])/).filter(Boolean);
    for (const word of camelCaseSplit) {
      if (word) {
        words.push(word);
      }
    }
  }
  
  return words.length > 0 ? words : [str];
}

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}