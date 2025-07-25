/**
 * Generates a unique identifier using the Web Crypto API.
 * 
 * This function creates a cryptographically secure random UUID that can be used
 * as a unique identifier for vision contexts. It uses the native `crypto.randomUUID()`
 * method for optimal performance and security.
 * 
 * @returns A unique UUID string
 * 
 * @example
 * ```typescript
 * const id = generateId();
 * console.log(id); // "123e4567-e89b-12d3-a456-426614174000"
 * ```
 */
export function generateId(): string {
  return crypto.randomUUID();
}
