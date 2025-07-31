// Core instrumentation functions
export {
  instrumentDataSource,
  instrumentRepository,
  instrumentEntityManager,
  instrumentQueryRunner,
} from "./instrumentTypeOrm";

// Transaction utilities
export {
  visionTransaction,
  visionTransactionWithIsolation,
  visionQueryRunner,
} from "./transactions";

// Decorators for advanced usage
export {
  VisionInstrumented,
  VisionObserve,
  VisionParam,
  VisionEntity,
} from "./decorators";

// Types and configuration
export type {
  VisionTypeOrmConfig,
  VisionDataSource,
  VisionRepository,
  VisionEntityManager,
  VisionQueryRunner,
  TypeOrmQueryMeta,
  TypeOrmOperationMeta,
  TypeOrmTransactionMeta,
  TypeOrmMethodCategories,
  TypeOrmErrorDetails,
} from "./types";

// Utilities (mainly for advanced users)
export {
  DEFAULT_CONFIG,
  METHOD_CATEGORIES,
  redactSensitiveData,
  truncateQuery,
  extractEntityName,
  categorizeMethod,
  createOperationName,
  extractErrorDetails,
  shouldInstrumentMethod,
  isInternalMethod,
  safeSerializeParams,
} from "./utils";

// Convenience export for the most common use case
export { instrumentDataSource as default } from "./instrumentTypeOrm";