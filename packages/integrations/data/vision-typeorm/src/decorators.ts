import { vision } from "@rodrigopsasaki/vision";

import type { VisionTypeOrmConfig } from "./types";
import { DEFAULT_CONFIG, createOperationName, extractErrorDetails } from "./utils";

/**
 * Class decorator to automatically instrument all methods of a TypeORM entity repository
 */
export function VisionInstrumented(config: VisionTypeOrmConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return function <T extends { new (...args: any[]): any }>(constructor: T) {
    if (!finalConfig.enabled) {
      return constructor;
    }

    // Get the entity name from the constructor or class name
    const entityName = constructor.name.replace(/Repository$/, "").toLowerCase();

    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);

        // Instrument all prototype methods
        const proto = Object.getPrototypeOf(this);
        const methodNames = Object.getOwnPropertyNames(constructor.prototype).filter(
          (name) =>
            name !== "constructor" && typeof constructor.prototype[name] === "function" && !name.startsWith("_"),
        );

        methodNames.forEach((methodName) => {
          const originalMethod = constructor.prototype[methodName];
          proto[methodName] = instrumentMethod(originalMethod, methodName, entityName, finalConfig);
        });
      }
    };
  };
}

/**
 * Method decorator to instrument individual methods
 */
export function VisionObserve(config: VisionTypeOrmConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!finalConfig.enabled || !descriptor.value) {
      return descriptor;
    }

    const originalMethod = descriptor.value;
    const entityName = target.constructor.name.replace(/Repository$/, "").toLowerCase();

    descriptor.value = instrumentMethod(originalMethod, propertyKey, entityName, finalConfig);
    return descriptor;
  };
}

/**
 * Parameter decorator to automatically capture method parameters
 */
export function VisionParam(paramName?: string) {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const existingParamTypes = Reflect.getMetadata("design:paramtypes", target, propertyKey) || [];
    const existingParamNames = Reflect.getMetadata("vision:paramnames", target, propertyKey) || [];

    existingParamNames[parameterIndex] = paramName || `param_${parameterIndex}`;
    Reflect.defineMetadata("vision:paramnames", existingParamNames, target, propertyKey);
  };
}

/**
 * Helper function to instrument a single method
 */
function instrumentMethod(
  originalMethod: Function,
  methodName: string,
  entityName: string,
  config: Required<VisionTypeOrmConfig>,
): Function {
  return async function (this: any, ...args: any[]) {
    const operationName = createOperationName(methodName, entityName, config);

    return vision.observe(operationName, async () => {
      // Set basic operation metadata
      vision.set("database.operation", methodName);
      vision.set("database.target", "typeorm");
      vision.set("database.type", "repository");
      vision.set("database.entity", entityName);

      // Capture method parameters if enabled
      if (config.logParams && args.length > 0) {
        const paramNames = Reflect.getMetadata("vision:paramnames", this, methodName) || [];

        const params: Record<string, any> = {};
        args.forEach((arg, index) => {
          const paramName = paramNames[index] || `param_${index}`;
          params[paramName] = arg;
        });

        vision.set("database.params", params);
      }

      const startTime = Date.now();

      try {
        // Execute the original method
        const result = await originalMethod.apply(this, args);

        const duration = Date.now() - startTime;
        vision.set("database.duration_ms", duration);
        vision.set("database.success", true);

        // Log result count for queries that return arrays
        if (config.logResultCount && Array.isArray(result)) {
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
}

/**
 * Entity decorator to automatically instrument entity lifecycle events
 */
export function VisionEntity(config: VisionTypeOrmConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return function <T extends { new (...args: any[]): any }>(constructor: T) {
    if (!finalConfig.enabled) {
      return constructor;
    }

    const entityName = constructor.name.toLowerCase();

    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);

        // Add lifecycle event tracking
        const lifecycleMethods = [
          "beforeInsert",
          "afterInsert",
          "beforeUpdate",
          "afterUpdate",
          "beforeRemove",
          "afterRemove",
          "beforeLoad",
          "afterLoad",
        ];

        lifecycleMethods.forEach((methodName) => {
          if (this[methodName as keyof this]) {
            const originalMethod = this[methodName as keyof this] as Function;
            (this as any)[methodName] = async function (this: any, ...args: any[]) {
              const operationName = `db.${entityName}.${methodName}`;

              return vision.observe(operationName, async () => {
                vision.set("database.operation", methodName);
                vision.set("database.target", "typeorm");
                vision.set("database.type", "entity_lifecycle");
                vision.set("database.entity", entityName);

                const startTime = Date.now();

                try {
                  const result = await originalMethod.apply(this, args);

                  const duration = Date.now() - startTime;
                  vision.set("database.duration_ms", duration);
                  vision.set("database.success", true);

                  return result;
                } catch (error) {
                  const duration = Date.now() - startTime;
                  vision.set("database.duration_ms", duration);
                  vision.set("database.success", false);
                  vision.set(
                    "database.error",
                    error instanceof Error ? error.message : String(error),
                  );

                  throw error;
                }
              });
            };
          }
        });
      }
    };
  };
}
