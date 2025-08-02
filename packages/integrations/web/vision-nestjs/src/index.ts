import "reflect-metadata";

// Core exports
export { VisionModule } from "./module";
export { VisionInterceptor } from "./interceptor";
export { VisionGuard } from "./guard";
export { VisionService } from "./service";

// Decorators
export {
  VisionContext,
  VisionIgnore,
  VisionCapture,
  VisionPerformance,
  VisionSecurity,
  VisionAudit,
} from "./decorators";

// Types
export type {
  VisionNestJSOptions,
  VisionRequest,
  VisionResponse,
  VisionContextConfig,
  VisionCaptureConfig,
  VisionExecutionContextType,
} from "./types";

export type { VisionModuleAsyncOptions, VisionOptionsFactory } from "./module";

// Constants
export { VISION_NESTJS_OPTIONS, VISION_SERVICE, DEFAULT_VISION_NESTJS_OPTIONS } from "./types";

// Re-export Vision core for convenience
export { vision } from "@rodrigopsasaki/vision";
