// Main middleware exports
export {
  createVisionMiddleware,
  createSimpleVisionMiddleware,
  createComprehensiveVisionMiddleware,
} from "./middleware";

// Type exports
export type {
  VisionExpressOptions,
  VisionRequest,
  VisionResponse,
  VisionExpressMiddleware,
  RequestMetadata,
  ResponseMetadata,
  ErrorMetadata,
} from "./types";

// Utility exports
export {
  extractRequestMetadata,
  extractResponseMetadata,
  extractErrorMetadata,
  mergeOptions,
} from "./utils";

// Default configuration
export { DEFAULT_VISION_EXPRESS_OPTIONS } from "./types"; 