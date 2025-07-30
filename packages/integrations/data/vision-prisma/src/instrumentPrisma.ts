import { vision } from "@rodrigopsasaki/vision";

import type { VisionPrismaConfig, VisionPrismaClient, PrismaOperationMeta } from "./types";

const DEFAULT_CONFIG: Required<VisionPrismaConfig> = {
  enabled: true,
  logParams: false,
  logQuery: true,
  logResultCount: true,
  maxQueryLength: 1000,
  includeModelInName: true,
  operationPrefix: "db",
  redactFields: ["password", "token", "secret", "key", "hash"],
  logConnectionInfo: false,
};

/**
 * Redacts sensitive fields from an object
 */
function redactSensitiveData(obj: unknown, redactFields: string[]): unknown {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, redactFields));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (redactFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveData(value, redactFields);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Truncates query strings to prevent log bloat
 */
function truncateQuery(query: string, maxLength: number): string {
  if (query.length <= maxLength) return query;
  return query.slice(0, maxLength) + "... [truncated]";
}

/**
 * Extracts model name from Prisma method chain
 */
function extractModelFromMethod(method: string): string | undefined {
  // Handle cases like 'user.findMany', 'post.create', etc.
  const parts = method.split(".");
  return parts.length > 1 ? parts[0] : undefined;
}

/**
 * Creates operation name based on config
 */
function createOperationName(
  meta: PrismaOperationMeta,
  config: Required<VisionPrismaConfig>,
): string {
  const parts = [config.operationPrefix];

  if (config.includeModelInName && meta.model) {
    parts.push(meta.model);
  }

  parts.push(meta.operation);

  return parts.join(".");
}

/**
 * Instruments a Prisma client with Vision observability
 */
export function instrumentPrisma(
  prismaClient: VisionPrismaClient,
  config: VisionPrismaConfig = {},
): VisionPrismaClient {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    return prismaClient;
  }

  // Create a proxy to intercept all method calls
  return new Proxy(prismaClient, {
    get(target, prop) {
      const originalMethod = target[prop as keyof VisionPrismaClient];

      // Don't intercept internal Prisma methods or non-functions
      if (
        typeof prop === "symbol" ||
        typeof originalMethod !== "function" ||
        prop.toString().startsWith("$") ||
        prop === "constructor"
      ) {
        return originalMethod;
      }

      // Return wrapped method that creates Vision context
      return function (...args: unknown[]) {
        const method = prop.toString();
        const model = extractModelFromMethod(method);

        const meta: PrismaOperationMeta = {
          model,
          operation: method,
          method,
          args: finalConfig.logParams
            ? redactSensitiveData(args, finalConfig.redactFields)
            : undefined,
          target: "prisma",
        };

        const operationName = createOperationName(meta, finalConfig);

        return vision.observe(operationName, async () => {
          // Set basic operation metadata
          vision.set("database.operation", meta.operation);
          vision.set("database.target", meta.target);

          if (meta.model) {
            vision.set("database.model", meta.model);
          }

          if (finalConfig.logParams && meta.args) {
            vision.set("database.params", meta.args);
          }

          if (finalConfig.logConnectionInfo) {
            // Add connection info if available
            vision.set("database.provider", "prisma");
          }

          const startTime = Date.now();

          try {
            // Execute the original method
            const result = await originalMethod.apply(target, args);

            const duration = Date.now() - startTime;
            vision.set("database.duration_ms", duration);
            vision.set("database.success", true);

            // Log result count for queries that return arrays
            if (finalConfig.logResultCount && Array.isArray(result)) {
              vision.set("database.result_count", result.length);
            }

            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            vision.set("database.duration_ms", duration);
            vision.set("database.success", false);
            vision.set("database.error", error instanceof Error ? error.message : String(error));

            throw error;
          }
        });
      };
    },
  });
}

/**
 * Enhanced instrumentation that also captures Prisma query events
 */
export function instrumentPrismaWithQueryLogging(
  prismaClient: VisionPrismaClient,
  config: VisionPrismaConfig = {},
): VisionPrismaClient {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const instrumentedClient = instrumentPrisma(prismaClient, config);

  if (!finalConfig.enabled || !finalConfig.logQuery) {
    return instrumentedClient;
  }

  // Set up query event logging
  try {
    prismaClient.$on("query", (event) => {
      // Only log if we're within a Vision context
      try {
        vision.context();

        if (finalConfig.logQuery) {
          const query = truncateQuery(event.query, finalConfig.maxQueryLength);
          vision.set("database.query", query);
        }

        if (finalConfig.logParams && event.params) {
          const params = redactSensitiveData(JSON.parse(event.params), finalConfig.redactFields);
          vision.set("database.query_params", params);
        }

        vision.set("database.query_duration_ms", event.duration);
        vision.set("database.query_timestamp", event.timestamp);
      } catch {
        // Not in a Vision context, ignore
      }
    });
  } catch {
    // Client doesn't support query events, continue without them
  }

  return instrumentedClient;
}
