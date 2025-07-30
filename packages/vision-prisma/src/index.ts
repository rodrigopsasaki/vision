export type {
  VisionPrismaConfig,
  VisionPrismaClient,
  PrismaQueryEvent,
  PrismaOperationMeta,
} from "./types";

export { instrumentPrisma, instrumentPrismaWithQueryLogging } from "./instrumentPrisma";

// Convenience export for the most common use case
export { instrumentPrisma as default } from "./instrumentPrisma";
