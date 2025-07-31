import type { VisionTypeOrmConfig, TypeOrmMethodCategories, TypeOrmErrorDetails } from "./types";

export const DEFAULT_CONFIG: Required<VisionTypeOrmConfig> = {
  enabled: true,
  logParams: false,
  logQuery: true,
  logResultCount: true,
  maxQueryLength: 1000,
  includeEntityInName: true,
  operationPrefix: "db",
  redactFields: ["password", "token", "secret", "key", "hash"],
  logConnectionInfo: false,
  instrumentTransactions: true,
  instrumentRepositories: true,
  instrumentEntityManager: true,
};

/**
 * TypeORM method categorization for better operation naming
 */
export const METHOD_CATEGORIES: TypeOrmMethodCategories = {
  query: ["query", "createQueryBuilder", "createSelectQueryBuilder"],
  find: [
    "find", "findBy", "findAndCount", "findAndCountBy", "findOne", "findOneBy", 
    "findOneOrFail", "findOneByOrFail", "count", "countBy", "exist", "existBy"
  ],
  save: ["save", "insert", "update", "upsert"],
  remove: ["remove", "delete", "softRemove", "softDelete", "restore"],
  transaction: ["transaction", "createQueryRunner"],
  schema: ["synchronize", "dropDatabase", "createDatabase", "runMigrations"],
};

/**
 * Redacts sensitive fields from an object
 */
export function redactSensitiveData(obj: unknown, redactFields: string[]): unknown {
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
export function truncateQuery(query: string, maxLength: number): string {
  if (query.length <= maxLength) return query;
  return query.slice(0, maxLength) + "... [truncated]";
}

/**
 * Extracts entity name from repository target or method context
 */
export function extractEntityName(target: unknown): string | undefined {
  if (!target || typeof target !== "object") return undefined;

  // Try to get entity from repository metadata
  if ("target" in target && target.target) {
    const entityTarget = target.target as any;
    if (typeof entityTarget === "function") {
      return entityTarget.name;
    }
    if (typeof entityTarget === "string") {
      return entityTarget;
    }
  }

  // Try to get from metadata
  if ("metadata" in target && target.metadata) {
    const metadata = target.metadata as any;
    if (metadata.targetName) {
      return metadata.targetName;
    }
    if (metadata.name) {
      return metadata.name;
    }
  }

  return undefined;
}

/**
 * Categorizes TypeORM methods for better operation naming
 */
export function categorizeMethod(method: string): string {
  for (const [category, methods] of Object.entries(METHOD_CATEGORIES)) {
    if (methods.includes(method)) {
      return category;
    }
  }
  return "operation";
}

/**
 * Creates operation name based on config and method info
 */
export function createOperationName(
  method: string,
  entity: string | undefined,
  config: Required<VisionTypeOrmConfig>,
): string {
  const parts = [config.operationPrefix];
  
  if (config.includeEntityInName && entity) {
    parts.push(entity.toLowerCase());
  }

  const category = categorizeMethod(method);
  parts.push(category);

  return parts.join(".");
}

/**
 * Extracts error details from TypeORM errors
 */
export function extractErrorDetails(error: unknown): TypeOrmErrorDetails {
  const details: TypeOrmErrorDetails = {};

  if (error && typeof error === "object") {
    const err = error as any;
    
    if (err.code) details.code = err.code;
    if (err.sqlState) details.sqlState = err.sqlState;
    if (err.query) details.query = err.query;
    if (err.parameters) details.parameters = err.parameters;
    if (err.constraint) details.constraint = err.constraint;
    if (err.table) details.table = err.table;
    if (err.column) details.column = err.column;
  }

  return details;
}

/**
 * Determines if a method should be instrumented based on config
 */
export function shouldInstrumentMethod(
  method: string,
  type: "datasource" | "repository" | "entitymanager" | "queryrunner",
  config: Required<VisionTypeOrmConfig>,
): boolean {
  if (!config.enabled) return false;

  switch (type) {
    case "repository":
      return config.instrumentRepositories;
    case "entitymanager":
      return config.instrumentEntityManager;
    case "datasource":
    case "queryrunner":
      return true; // Always instrument these core components
    default:
      return true;
  }
}

/**
 * Checks if a method is internal/private and should not be instrumented
 */
export function isInternalMethod(method: string): boolean {
  return (
    method.startsWith("_") ||
    method.startsWith("$") ||
    method === "constructor" ||
    method === "toString" ||
    method === "valueOf" ||
    method === "hasOwnProperty" ||
    method === "isPrototypeOf" ||
    method === "propertyIsEnumerable" ||
    method === "toLocaleString"
  );
}

/**
 * Safely serializes query parameters, handling circular references
 */
export function safeSerializeParams(params: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(params, (key, value) => {
      if (typeof value === "function") return "[Function]";
      if (typeof value === "symbol") return "[Symbol]";
      if (typeof value === "bigint") return value.toString() + "n";
      if (value instanceof Date) return value.toISOString();
      if (value instanceof RegExp) return value.toString();
      return value;
    }));
  } catch {
    return "[Circular or Non-Serializable]";
  }
}