// Core exports
export {
  visionPlugin,
  createMinimalVisionPlugin,
  createComprehensiveVisionPlugin,
  createPerformanceVisionPlugin,
} from "./plugin";

// Types
export type {
  VisionFastifyOptions,
  VisionFastifyPluginOptions,
  VisionFastifyRequest,
  VisionFastifyReply,
  RequestMetadata,
  ResponseMetadata,
  ErrorMetadata,
} from "./types";

export {
  DEFAULT_VISION_FASTIFY_OPTIONS,
} from "./types";

// Utilities
export {
  extractRequestMetadata,
  extractResponseMetadata,
  extractErrorMetadata,
  isRouteExcluded,
  isSlowOperation,
  generateRequestId,
  mergeOptions,
} from "./utils";

// Re-export Vision core for convenience
export { vision } from "@rodrigopsasaki/vision";