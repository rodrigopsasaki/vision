/**
 * Configuration options for Vision Prisma integration
 */
export interface VisionPrismaConfig {
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
   * Whether to log the actual query SQL
   * @default true
   */
  logQuery?: boolean;

  /**
   * Whether to capture query results count (for find operations)
   * @default true
   */
  logResultCount?: boolean;

  /**
   * Maximum query length to log (prevents huge queries from bloating logs)
   * @default 1000
   */
  maxQueryLength?: number;

  /**
   * Whether to include model name in the operation name
   * @default true
   */
  includeModelInName?: boolean;

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
}

/**
 * Prisma query event information
 */
export interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

/**
 * Prisma operation metadata
 */
export interface PrismaOperationMeta {
  model?: string;
  operation: string;
  method: string;
  args?: unknown;
  target: string;
}

/**
 * Enhanced Prisma client with Vision instrumentation
 */
export interface VisionPrismaClient {
  $on: (event: "query", callback: (e: PrismaQueryEvent) => void) => void;
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $executeRaw: (...args: unknown[]) => Promise<unknown>;
  $queryRaw: (...args: unknown[]) => Promise<unknown>;
  $transaction: (...args: unknown[]) => Promise<unknown>;
  [key: string]: unknown;
}
