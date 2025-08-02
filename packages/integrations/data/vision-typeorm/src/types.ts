import type { DataSource, EntityManager, Repository, QueryRunner } from "typeorm";

/**
 * Configuration options for Vision TypeORM integration
 */
export interface VisionTypeOrmConfig {
  /**
   * Whether to enable Vision instrumentation
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to log query parameters (may contain sensitive data)
   * @default false
   */
  logParams?: boolean;

  /**
   * Whether to log the actual SQL query
   * @default true
   */
  logQuery?: boolean;

  /**
   * Whether to capture query results count (for select operations)
   * @default true
   */
  logResultCount?: boolean;

  /**
   * Maximum query length to log (prevents huge queries from bloating logs)
   * @default 1000
   */
  maxQueryLength?: number;

  /**
   * Whether to include entity name in the operation name
   * @default true
   */
  includeEntityInName?: boolean;

  /**
   * Custom operation name prefix
   * @default "db"
   */
  operationPrefix?: string;

  /**
   * Fields to redact from query parameters
   * @default ["password", "token", "secret", "key", "hash"]
   */
  redactFields?: string[];

  /**
   * Whether to capture database connection info
   * @default false
   */
  logConnectionInfo?: boolean;

  /**
   * Whether to instrument transaction operations
   * @default true
   */
  instrumentTransactions?: boolean;

  /**
   * Whether to instrument repository operations
   * @default true
   */
  instrumentRepositories?: boolean;

  /**
   * Whether to instrument entity manager operations
   * @default true
   */
  instrumentEntityManager?: boolean;
}

/**
 * TypeORM query metadata
 */
export interface TypeOrmQueryMeta {
  sql?: string;
  parameters?: unknown[];
  duration?: number;
  affected?: number;
  entity?: string;
  operation: string;
  method: string;
  target: "typeorm";
}

/**
 * TypeORM operation metadata
 */
export interface TypeOrmOperationMeta {
  entity?: string;
  operation: string;
  method: string;
  args?: unknown;
  target: "typeorm";
  type: "datasource" | "repository" | "entitymanager" | "queryrunner";
}

/**
 * TypeORM transaction metadata
 */
export interface TypeOrmTransactionMeta {
  isolationLevel?: string;
  isNested?: boolean;
  queryCount?: number;
  target: "typeorm";
}

/**
 * Enhanced DataSource with Vision instrumentation
 */
export interface VisionDataSource extends DataSource {
  __visionInstrumented?: boolean;
}

/**
 * Enhanced Repository with Vision instrumentation
 */
export interface VisionRepository<Entity extends Record<string, any>> extends Repository<Entity> {
  __visionInstrumented?: boolean;
  __entityName?: string;
}

/**
 * Enhanced EntityManager with Vision instrumentation
 */
export interface VisionEntityManager extends EntityManager {
  __visionInstrumented?: boolean;
}

/**
 * Enhanced QueryRunner with Vision instrumentation
 */
export interface VisionQueryRunner extends QueryRunner {
  __visionInstrumented?: boolean;
}

/**
 * TypeORM method categories for better observability
 */
export interface TypeOrmMethodCategories {
  query: string[];
  find: string[];
  save: string[];
  remove: string[];
  transaction: string[];
  schema: string[];
}

/**
 * TypeORM error details for Vision context
 */
export interface TypeOrmErrorDetails {
  code?: string;
  sqlState?: string;
  query?: string;
  parameters?: unknown[];
  constraint?: string;
  table?: string;
  column?: string;
}
