import { vision } from "@rodrigopsasaki/vision";
import type { DataSource, Repository, EntityManager, QueryRunner } from "typeorm";

import type {
  VisionTypeOrmConfig,
  VisionDataSource,
  VisionRepository,
  VisionEntityManager,
  VisionQueryRunner,
  TypeOrmOperationMeta,
} from "./types";
import {
  DEFAULT_CONFIG,
  redactSensitiveData,
  truncateQuery,
  extractEntityName,
  createOperationName,
  extractErrorDetails,
  shouldInstrumentMethod,
  isInternalMethod,
  safeSerializeParams,
} from "./utils";

/**
 * Instruments a TypeORM DataSource with Vision observability
 */
export function instrumentDataSource(
  dataSource: DataSource,
  config: VisionTypeOrmConfig = {},
): VisionDataSource {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const visionDataSource = dataSource as VisionDataSource;

  if (!finalConfig.enabled || visionDataSource.__visionInstrumented) {
    return visionDataSource;
  }

  // Create a proxy to intercept all method calls
  const instrumentedDataSource = new Proxy(visionDataSource, {
    get(target, prop) {
      const originalMethod = target[prop as keyof DataSource];
      const method = prop.toString();

      // Don't intercept internal methods or non-functions
      if (
        typeof prop === "symbol" ||
        typeof originalMethod !== "function" ||
        isInternalMethod(method)
      ) {
        return originalMethod;
      }

      // Don't instrument if config says not to
      if (!shouldInstrumentMethod(method, "datasource", finalConfig)) {
        return originalMethod;
      }

      // Return wrapped method that creates Vision context
      return function (...args: unknown[]) {
        const meta: TypeOrmOperationMeta = {
          operation: method,
          method,
          args: finalConfig.logParams
            ? redactSensitiveData(safeSerializeParams(args), finalConfig.redactFields)
            : undefined,
          target: "typeorm",
          type: "datasource",
        };

        const operationName = createOperationName(method, undefined, finalConfig);

        return vision.observe(operationName, async () => {
          // Set basic operation metadata
          vision.set("database.operation", meta.operation);
          vision.set("database.target", meta.target);
          vision.set("database.type", meta.type);

          if (finalConfig.logParams && meta.args) {
            vision.set("database.params", meta.args);
          }

          if (finalConfig.logConnectionInfo) {
            vision.set("database.provider", "typeorm");
            if (target.options) {
              vision.set("database.driver", target.options.type);
              if (target.options.database) {
                vision.set("database.name", target.options.database);
              }
            }
          }

          const startTime = Date.now();

          try {
            // Execute the original method
            const result = await (originalMethod as any).apply(target, args);

            const duration = Date.now() - startTime;
            vision.set("database.duration_ms", duration);
            vision.set("database.success", true);

            // Log result count for queries that return arrays
            if (finalConfig.logResultCount && Array.isArray(result)) {
              vision.set("database.result_count", result.length);
            }

            // Instrument repositories returned by getRepository
            if (method === "getRepository" && result) {
              return instrumentRepository(result as Repository<Record<string, any>>, finalConfig);
            }

            // Instrument entity manager
            if ((method === "manager" || method === "createEntityManager") && result) {
              return instrumentEntityManager(result as EntityManager, finalConfig);
            }

            // Instrument query runner
            if (method === "createQueryRunner" && result) {
              return instrumentQueryRunner(result as QueryRunner, finalConfig);
            }

            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            vision.set("database.duration_ms", duration);
            vision.set("database.success", false);
            vision.set("database.error", error instanceof Error ? error.message : String(error));

            const errorDetails = extractErrorDetails(error);
            if (Object.keys(errorDetails).length > 0) {
              vision.set("database.error_details", errorDetails);
            }

            throw error;
          }
        });
      };
    },
  });

  instrumentedDataSource.__visionInstrumented = true;
  return instrumentedDataSource;
}

/**
 * Instruments a TypeORM Repository with Vision observability
 */
export function instrumentRepository<Entity extends Record<string, any>>(
  repository: Repository<Entity>,
  config: VisionTypeOrmConfig = {},
): VisionRepository<Entity> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const visionRepository = repository as VisionRepository<Entity>;

  if (!finalConfig.enabled || visionRepository.__visionInstrumented) {
    return visionRepository;
  }

  // Extract entity name
  const entityName = extractEntityName(repository);
  visionRepository.__entityName = entityName;

  // Create a proxy to intercept all method calls
  const instrumentedRepository = new Proxy(visionRepository, {
    get(target, prop) {
      const originalMethod = target[prop as keyof Repository<Entity>];
      const method = prop.toString();

      // Don't intercept internal methods or non-functions
      if (
        typeof prop === "symbol" ||
        typeof originalMethod !== "function" ||
        isInternalMethod(method)
      ) {
        return originalMethod;
      }

      // Don't instrument if config says not to
      if (!shouldInstrumentMethod(method, "repository", finalConfig)) {
        return originalMethod;
      }

      // Return wrapped method that creates Vision context
      return function (...args: unknown[]) {
        const meta: TypeOrmOperationMeta = {
          entity: entityName,
          operation: method,
          method,
          args: finalConfig.logParams
            ? redactSensitiveData(safeSerializeParams(args), finalConfig.redactFields)
            : undefined,
          target: "typeorm",
          type: "repository",
        };

        const operationName = createOperationName(method, entityName, finalConfig);

        return vision.observe(operationName, async () => {
          // Set basic operation metadata
          vision.set("database.operation", meta.operation);
          vision.set("database.target", meta.target);
          vision.set("database.type", meta.type);

          if (meta.entity) {
            vision.set("database.entity", meta.entity);
          }

          if (finalConfig.logParams && meta.args) {
            vision.set("database.params", meta.args);
          }

          const startTime = Date.now();

          try {
            // Execute the original method
            const result = await (originalMethod as any).apply(target, args);

            const duration = Date.now() - startTime;
            vision.set("database.duration_ms", duration);
            vision.set("database.success", true);

            // Log result count for queries that return arrays
            if (finalConfig.logResultCount && Array.isArray(result)) {
              vision.set("database.result_count", result.length);
            }

            // Log affected rows for save/update/delete operations
            if (result && typeof result === "object" && "affected" in result) {
              vision.set("database.affected_rows", result.affected);
            }

            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            vision.set("database.duration_ms", duration);
            vision.set("database.success", false);
            vision.set("database.error", error instanceof Error ? error.message : String(error));

            const errorDetails = extractErrorDetails(error);
            if (Object.keys(errorDetails).length > 0) {
              vision.set("database.error_details", errorDetails);
            }

            throw error;
          }
        });
      };
    },
  });

  instrumentedRepository.__visionInstrumented = true;
  return instrumentedRepository;
}

/**
 * Instruments a TypeORM EntityManager with Vision observability
 */
export function instrumentEntityManager(
  entityManager: EntityManager,
  config: VisionTypeOrmConfig = {},
): VisionEntityManager {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const visionEntityManager = entityManager as VisionEntityManager;

  if (!finalConfig.enabled || visionEntityManager.__visionInstrumented) {
    return visionEntityManager;
  }

  // Create a proxy to intercept all method calls
  const instrumentedEntityManager = new Proxy(visionEntityManager, {
    get(target, prop) {
      const originalMethod = target[prop as keyof EntityManager];
      const method = prop.toString();

      // Don't intercept internal methods or non-functions
      if (
        typeof prop === "symbol" ||
        typeof originalMethod !== "function" ||
        isInternalMethod(method)
      ) {
        return originalMethod;
      }

      // Don't instrument if config says not to
      if (!shouldInstrumentMethod(method, "entitymanager", finalConfig)) {
        return originalMethod;
      }

      // Return wrapped method that creates Vision context
      return function (...args: unknown[]) {
        // Try to extract entity name from first argument
        let entityName: string | undefined;
        if (args.length > 0) {
          if (typeof args[0] === "function") {
            entityName = (args[0] as Function).name;
          } else if (typeof args[0] === "string") {
            entityName = args[0];
          }
        }

        const meta: TypeOrmOperationMeta = {
          entity: entityName,
          operation: method,
          method,
          args: finalConfig.logParams
            ? redactSensitiveData(safeSerializeParams(args), finalConfig.redactFields)
            : undefined,
          target: "typeorm",
          type: "entitymanager",
        };

        const operationName = createOperationName(method, entityName, finalConfig);

        return vision.observe(operationName, async () => {
          // Set basic operation metadata
          vision.set("database.operation", meta.operation);
          vision.set("database.target", meta.target);
          vision.set("database.type", meta.type);

          if (meta.entity) {
            vision.set("database.entity", meta.entity);
          }

          if (finalConfig.logParams && meta.args) {
            vision.set("database.params", meta.args);
          }

          const startTime = Date.now();

          try {
            // Execute the original method
            const result = await (originalMethod as any).apply(target, args);

            const duration = Date.now() - startTime;
            vision.set("database.duration_ms", duration);
            vision.set("database.success", true);

            // Log result count for queries that return arrays
            if (finalConfig.logResultCount && Array.isArray(result)) {
              vision.set("database.result_count", result.length);
            }

            // Log affected rows for save/update/delete operations
            if (result && typeof result === "object" && "affected" in result) {
              vision.set("database.affected_rows", result.affected);
            }

            // Instrument getRepository calls
            if (method === "getRepository" && result) {
              return instrumentRepository(result as Repository<Record<string, any>>, finalConfig);
            }

            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            vision.set("database.duration_ms", duration);
            vision.set("database.success", false);
            vision.set("database.error", error instanceof Error ? error.message : String(error));

            const errorDetails = extractErrorDetails(error);
            if (Object.keys(errorDetails).length > 0) {
              vision.set("database.error_details", errorDetails);
            }

            throw error;
          }
        });
      };
    },
  });

  instrumentedEntityManager.__visionInstrumented = true;
  return instrumentedEntityManager;
}

/**
 * Instruments a TypeORM QueryRunner with Vision observability
 */
export function instrumentQueryRunner(
  queryRunner: QueryRunner,
  config: VisionTypeOrmConfig = {},
): VisionQueryRunner {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const visionQueryRunner = queryRunner as VisionQueryRunner;

  if (!finalConfig.enabled || visionQueryRunner.__visionInstrumented) {
    return visionQueryRunner;
  }

  // Create a proxy to intercept all method calls
  const instrumentedQueryRunner = new Proxy(visionQueryRunner, {
    get(target, prop) {
      const originalMethod = target[prop as keyof QueryRunner];
      const method = prop.toString();

      // Don't intercept internal methods or non-functions
      if (
        typeof prop === "symbol" ||
        typeof originalMethod !== "function" ||
        isInternalMethod(method)
      ) {
        return originalMethod;
      }

      // Return wrapped method that creates Vision context
      return function (...args: unknown[]) {
        const meta: TypeOrmOperationMeta = {
          operation: method,
          method,
          args: finalConfig.logParams
            ? redactSensitiveData(safeSerializeParams(args), finalConfig.redactFields)
            : undefined,
          target: "typeorm",
          type: "queryrunner",
        };

        const operationName = createOperationName(method, undefined, finalConfig);

        return vision.observe(operationName, async () => {
          // Set basic operation metadata
          vision.set("database.operation", meta.operation);
          vision.set("database.target", meta.target);
          vision.set("database.type", meta.type);

          if (finalConfig.logParams && meta.args) {
            vision.set("database.params", meta.args);
          }

          // Log SQL query for query method
          if (method === "query" && args.length > 0 && typeof args[0] === "string") {
            const query = truncateQuery(args[0], finalConfig.maxQueryLength);
            vision.set("database.query", query);

            if (args.length > 1 && finalConfig.logParams) {
              const params = redactSensitiveData(args[1], finalConfig.redactFields);
              vision.set("database.query_params", params);
            }
          }

          const startTime = Date.now();

          try {
            // Execute the original method
            const result = await (originalMethod as any).apply(target, args);

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

            const errorDetails = extractErrorDetails(error);
            if (Object.keys(errorDetails).length > 0) {
              vision.set("database.error_details", errorDetails);
            }

            throw error;
          }
        });
      };
    },
  });

  instrumentedQueryRunner.__visionInstrumented = true;
  return instrumentedQueryRunner;
}
