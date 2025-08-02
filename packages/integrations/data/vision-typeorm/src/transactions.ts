import { vision } from "@rodrigopsasaki/vision";
import { DataSource, EntityManager, QueryRunner } from "typeorm";

import type { VisionTypeOrmConfig, TypeOrmTransactionMeta } from "./types";
import { DEFAULT_CONFIG, extractErrorDetails } from "./utils";

// TypeORM 0.3 isolation levels as string union
type IsolationLevel = "READ UNCOMMITTED" | "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

/**
 * Enhanced transaction wrapper that provides Vision observability
 */
export async function visionTransaction<T>(
  dataSourceOrManager: DataSource | EntityManager,
  runInTransaction: (manager: EntityManager) => Promise<T>,
  config: VisionTypeOrmConfig = {},
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled || !finalConfig.instrumentTransactions) {
    // Fall back to regular transaction if instrumentation is disabled
    if (dataSourceOrManager instanceof DataSource) {
      return dataSourceOrManager.transaction(runInTransaction);
    } else {
      return dataSourceOrManager.transaction(runInTransaction);
    }
  }

  return vision.observe("db.transaction", async () => {
    vision.set("database.operation", "transaction");
    vision.set("database.target", "typeorm");
    vision.set("database.type", "transaction");

    const meta: TypeOrmTransactionMeta = {
      isNested: false,
      queryCount: 0,
      target: "typeorm",
    };

    // Detect if we're already in a transaction (nested)
    try {
      vision.context();
      const existingContext = vision.get("database.type");
      if (existingContext === "transaction") {
        meta.isNested = true;
        vision.set("database.nested", true);
      }
    } catch {
      // Not in a Vision context, this is fine
    }

    const startTime = Date.now();

    try {
      let result: T;

      if (dataSourceOrManager instanceof DataSource) {
        // DataSource transaction
        result = await dataSourceOrManager.transaction(async (manager) => {
          // Instrument the transaction manager
          const instrumentedManager = createTransactionManagerProxy(manager, meta, finalConfig);
          return runInTransaction(instrumentedManager);
        });
      } else {
        // EntityManager transaction
        result = await dataSourceOrManager.transaction(async (manager) => {
          // Instrument the transaction manager
          const instrumentedManager = createTransactionManagerProxy(manager, meta, finalConfig);
          return runInTransaction(instrumentedManager);
        });
      }

      const duration = Date.now() - startTime;
      vision.set("database.duration_ms", duration);
      vision.set("database.success", true);
      vision.set("database.query_count", meta.queryCount);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      vision.set("database.duration_ms", duration);
      vision.set("database.success", false);
      vision.set("database.error", error instanceof Error ? error.message : String(error));
      vision.set("database.query_count", meta.queryCount);

      const errorDetails = extractErrorDetails(error);
      if (Object.keys(errorDetails).length > 0) {
        vision.set("database.error_details", errorDetails);
      }

      throw error;
    }
  });
}

/**
 * Enhanced transaction wrapper with explicit isolation level
 */
export async function visionTransactionWithIsolation<T>(
  dataSourceOrManager: DataSource | EntityManager,
  isolationLevel: IsolationLevel,
  runInTransaction: (manager: EntityManager) => Promise<T>,
  config: VisionTypeOrmConfig = {},
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled || !finalConfig.instrumentTransactions) {
    // Fall back to regular transaction if instrumentation is disabled
    if (dataSourceOrManager instanceof DataSource) {
      return dataSourceOrManager.transaction(isolationLevel, runInTransaction);
    } else {
      return dataSourceOrManager.transaction(isolationLevel, runInTransaction);
    }
  }

  return vision.observe("db.transaction.isolated", async () => {
    vision.set("database.operation", "transaction");
    vision.set("database.target", "typeorm");
    vision.set("database.type", "transaction");
    vision.set("database.isolation_level", isolationLevel);

    const meta: TypeOrmTransactionMeta = {
      isolationLevel,
      isNested: false,
      queryCount: 0,
      target: "typeorm",
    };

    // Detect if we're already in a transaction (nested)
    try {
      vision.context();
      const existingContext = vision.get("database.type");
      if (existingContext === "transaction") {
        meta.isNested = true;
        vision.set("database.nested", true);
      }
    } catch {
      // Not in a Vision context, this is fine
    }

    const startTime = Date.now();

    try {
      let result: T;

      if (dataSourceOrManager instanceof DataSource) {
        // DataSource transaction
        result = await dataSourceOrManager.transaction(isolationLevel, async (manager) => {
          // Instrument the transaction manager
          const instrumentedManager = createTransactionManagerProxy(manager, meta, finalConfig);
          return runInTransaction(instrumentedManager);
        });
      } else {
        // EntityManager transaction
        result = await dataSourceOrManager.transaction(isolationLevel, async (manager) => {
          // Instrument the transaction manager
          const instrumentedManager = createTransactionManagerProxy(manager, meta, finalConfig);
          return runInTransaction(instrumentedManager);
        });
      }

      const duration = Date.now() - startTime;
      vision.set("database.duration_ms", duration);
      vision.set("database.success", true);
      vision.set("database.query_count", meta.queryCount);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      vision.set("database.duration_ms", duration);
      vision.set("database.success", false);
      vision.set("database.error", error instanceof Error ? error.message : String(error));
      vision.set("database.query_count", meta.queryCount);

      const errorDetails = extractErrorDetails(error);
      if (Object.keys(errorDetails).length > 0) {
        vision.set("database.error_details", errorDetails);
      }

      throw error;
    }
  });
}

/**
 * Creates a proxy for the transaction EntityManager to track queries
 */
function createTransactionManagerProxy(
  manager: EntityManager,
  meta: TypeOrmTransactionMeta,
  config: Required<VisionTypeOrmConfig>,
): EntityManager {
  return new Proxy(manager, {
    get(target, prop) {
      const originalMethod = target[prop as keyof EntityManager];
      const method = prop.toString();

      // Don't intercept internal methods or non-functions
      if (
        typeof prop === "symbol" ||
        typeof originalMethod !== "function" ||
        method.startsWith("_") ||
        method === "constructor"
      ) {
        return originalMethod;
      }

      // Track query operations
      const queryMethods = [
        "query",
        "save",
        "insert",
        "update",
        "delete",
        "remove",
        "find",
        "findOne",
        "findBy",
        "findOneBy",
        "count",
        "countBy",
      ];

      if (queryMethods.includes(method)) {
        return function (...args: unknown[]) {
          meta.queryCount = (meta.queryCount || 0) + 1;

          // Add query tracking to current Vision context
          try {
            const currentCount = (vision.get("database.query_count") as number) || 0;
            vision.set("database.query_count", currentCount + 1);
          } catch {
            // Not in a Vision context, ignore
          }

          return (originalMethod as Function).apply(target, args);
        };
      }

      return originalMethod;
    },
  });
}

/**
 * Query runner wrapper for manual transaction management
 */
export async function visionQueryRunner<T>(
  dataSource: DataSource,
  runWithQueryRunner: (queryRunner: QueryRunner) => Promise<T>,
  config: VisionTypeOrmConfig = {},
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    const queryRunner = dataSource.createQueryRunner();
    try {
      return await runWithQueryRunner(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  return vision.observe("db.queryrunner", async () => {
    vision.set("database.operation", "queryrunner");
    vision.set("database.target", "typeorm");
    vision.set("database.type", "queryrunner");

    const queryRunner = dataSource.createQueryRunner();
    const startTime = Date.now();
    let queryCount = 0;

    // Create a proxy to track queries
    const instrumentedQueryRunner = new Proxy(queryRunner, {
      get(target, prop) {
        const originalMethod = target[prop as keyof QueryRunner];
        const method = prop.toString();

        if (method === "query" && typeof originalMethod === "function") {
          return function (...args: unknown[]) {
            queryCount++;
            vision.set("database.query_count", queryCount);
            return (originalMethod as Function).apply(target, args);
          };
        }

        return originalMethod;
      },
    });

    try {
      const result = await runWithQueryRunner(instrumentedQueryRunner);

      const duration = Date.now() - startTime;
      vision.set("database.duration_ms", duration);
      vision.set("database.success", true);
      vision.set("database.final_query_count", queryCount);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      vision.set("database.duration_ms", duration);
      vision.set("database.success", false);
      vision.set("database.error", error instanceof Error ? error.message : String(error));
      vision.set("database.final_query_count", queryCount);

      const errorDetails = extractErrorDetails(error);
      if (Object.keys(errorDetails).length > 0) {
        vision.set("database.error_details", errorDetails);
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  });
}
