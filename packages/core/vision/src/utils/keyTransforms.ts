/**
 * Supported casing styles for key normalization.
 */
export type CasingStyle = "camelCase" | "snake_case" | "kebab-case" | "PascalCase" | "none";

/**
 * Transforms a string key to the specified casing style.
 *
 * @param key - The key to transform
 * @param style - The target casing style
 * @returns The transformed key
 *
 * @example
 * ```typescript
 * transformKey("userId", "snake_case"); // "user_id"
 * transformKey("user_id", "camelCase"); // "userId"
 * transformKey("user-name", "PascalCase"); // "UserName"
 * ```
 */
export function transformKey(key: string, style: CasingStyle): string {
  if (style === "none") {
    return key;
  }

  // First, split the key into words
  const words = splitIntoWords(key);

  switch (style) {
    case "camelCase":
      return words[0].toLowerCase() + words.slice(1).map(capitalize).join("");

    case "snake_case":
      return words.map((word) => word.toLowerCase()).join("_");

    case "kebab-case":
      return words.map((word) => word.toLowerCase()).join("-");

    case "PascalCase":
      return words.map(capitalize).join("");

    default:
      return key;
  }
}

/**
 * Splits a string into words, handling various separators and casing patterns.
 *
 * @param str - The string to split
 * @returns Array of words
 *
 * @example
 * ```typescript
 * splitIntoWords("userId"); // ["user", "Id"]
 * splitIntoWords("user_id"); // ["user", "id"]
 * splitIntoWords("user-name-here"); // ["user", "name", "here"]
 * splitIntoWords("XMLHttpRequest"); // ["XML", "Http", "Request"]
 * ```
 */
function splitIntoWords(str: string): string[] {
  // Handle empty or single character strings
  if (str.length <= 1) {
    return [str];
  }

  // Split on common delimiters first
  const parts = str.split(/[-_\s]+/).filter(Boolean);

  // Further split camelCase/PascalCase within each part
  const words: string[] = [];

  for (const part of parts) {
    if (!part) continue;

    // Split on camelCase/PascalCase boundaries
    const camelCaseSplit = part.split(/(?=[A-Z])/).filter(Boolean);

    for (const word of camelCaseSplit) {
      if (word) {
        words.push(word);
      }
    }
  }

  return words.length > 0 ? words : [str];
}

/**
 * Capitalizes the first letter of a word.
 *
 * @param word - The word to capitalize
 * @returns The capitalized word
 */
function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Transforms all keys in an object recursively to the specified casing style.
 *
 * @param obj - The object to transform
 * @param style - The target casing style
 * @param visited - Set to track visited objects to prevent infinite recursion
 * @returns A new object with transformed keys
 *
 * @example
 * ```typescript
 * const input = {
 *   userId: "123",
 *   userProfile: {
 *     firstName: "John",
 *     lastName: "Doe"
 *   },
 *   eventList: ["login", "logout"]
 * };
 *
 * transformObjectKeys(input, "snake_case");
 * // {
 * //   user_id: "123",
 * //   user_profile: {
 * //     first_name: "John",
 * //     last_name: "Doe"
 * //   },
 * //   event_list: ["login", "logout"]
 * // }
 * ```
 */
export function transformObjectKeys(
  obj: unknown,
  style: CasingStyle,
  visited = new WeakSet(),
): unknown {
  if (style === "none") {
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Check if we've already visited this object to prevent circular references
  if (typeof obj === "object" && obj !== null && visited.has(obj)) {
    return obj; // Return the original object to maintain the circular reference
  }

  if (Array.isArray(obj)) {
    visited.add(obj);
    const transformed = obj.map((item) => transformObjectKeys(item, style, visited));
    visited.delete(obj);
    return transformed;
  }

  if (typeof obj === "object" && obj.constructor === Object) {
    visited.add(obj);
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const transformedKey = transformKey(key, style);
      transformed[transformedKey] = transformObjectKeys(value, style, visited);
    }

    visited.delete(obj);
    return transformed;
  }

  // For primitives, dates, functions, etc., return as-is
  return obj;
}

/**
 * Transforms a Map's keys to the specified casing style.
 *
 * @param map - The Map to transform
 * @param style - The target casing style
 * @returns A new Map with transformed keys
 *
 * @example
 * ```typescript
 * const input = new Map([
 *   ["userId", "123"],
 *   ["firstName", "John"]
 * ]);
 *
 * const result = transformMapKeys(input, "snake_case");
 * // Map([["user_id", "123"], ["first_name", "John"]])
 * ```
 */
export function transformMapKeys(
  map: Map<string, unknown>,
  style: CasingStyle,
): Map<string, unknown> {
  if (style === "none") {
    return map;
  }

  const transformed = new Map<string, unknown>();
  const visited = new WeakSet();

  for (const [key, value] of map.entries()) {
    const transformedKey = transformKey(key, style);
    const transformedValue = transformObjectKeys(value, style, visited);
    transformed.set(transformedKey, transformedValue);
  }

  return transformed;
}
