import { vision } from "@rodrigopsasaki/vision";
import { Injectable, Optional, Inject } from "@nestjs/common";

import type { VisionNestJSOptions } from "./types";
import { VISION_NESTJS_OPTIONS } from "./types";

/**
 * Vision Service for NestJS applications.
 * 
 * This service provides access to the core Vision instance within NestJS
 * dependency injection. It simply exposes the Vision API without adding
 * any NestJS-specific methods, maintaining consistency with the core API.
 * 
 * @example
 * ```typescript
 * @Injectable()
 * export class UsersService {
 *   constructor(private readonly visionService: VisionService) {}
 *   
 *   async createUser(userData: CreateUserDto) {
 *     // Use the core Vision API through the service
 *     vision.set('operation', 'user_creation');
 *     vision.set('user_type', userData.type);
 *     
 *     try {
 *       const user = await this.userRepository.create(userData);
 *       
 *       // Track data using core Vision methods
 *       vision.push('events', {
 *         event: 'user_created',
 *         user_id: user.id,
 *         timestamp: new Date().toISOString(),
 *       });
 *       
 *       return user;
 *     } catch (error) {
 *       // Track errors
 *       vision.set('error', {
 *         type: 'user_creation_failed',
 *         message: error.message,
 *         email: userData.email,
 *       });
 *       throw error;
 *     }
 *   }
 * }
 * ```
 */
@Injectable()
export class VisionService {
  constructor(
    @Optional() @Inject(VISION_NESTJS_OPTIONS) private readonly options?: VisionNestJSOptions,
  ) {}

  /**
   * Returns the core Vision instance.
   * This allows direct access to all Vision methods while benefiting
   * from NestJS dependency injection.
   * 
   * @returns The Vision instance
   */
  get vision(): typeof vision {
    return vision;
  }

  /**
   * Checks if there's an active Vision context.
   * @returns True if a context exists, false otherwise
   */
  isInContext(): boolean {
    try {
      return vision.context() !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Gets the current Vision context.
   * @returns The current context or undefined if not in a context
   */
  getCurrentContext() {
    try {
      return vision.context();
    } catch {
      return undefined;
    }
  }
}