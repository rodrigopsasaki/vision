import { vision } from "@rodrigopsasaki/vision";
import type { DynamicModule, FactoryProvider, ModuleMetadata, Provider, Type } from "@nestjs/common";
import { Global, Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";

import { VisionGuard } from "./guard";
import { VisionInterceptor } from "./interceptor";
import { VisionService } from "./service";
import {
  VISION_NESTJS_OPTIONS,
  VISION_SERVICE,
  type VisionNestJSOptions,
} from "./types";

/**
 * Interface for configuring Vision module asynchronously.
 */
export interface VisionModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  /**
   * Factory function to create Vision options.
   */
  useFactory?: (...args: any[]) => Promise<VisionNestJSOptions> | VisionNestJSOptions;

  /**
   * Dependencies to inject into the factory function.
   */
  inject?: any[];

  /**
   * Class to use for creating Vision options.
   */
  useClass?: Type<VisionOptionsFactory>;

  /**
   * Existing provider to use for Vision options.
   */
  useExisting?: Type<VisionOptionsFactory>;

  /**
   * Whether the module should be global.
   * @default true
   */
  isGlobal?: boolean;
}

/**
 * Factory interface for creating Vision options.
 */
export interface VisionOptionsFactory {
  createVisionOptions(): Promise<VisionNestJSOptions> | VisionNestJSOptions;
}

/**
 * Vision module for NestJS applications.
 * 
 * This module provides comprehensive Vision integration with:
 * - Automatic interceptor registration
 * - Optional guard integration for enhanced security
 * - Injectable Vision service for manual context manipulation
 * - Support for dynamic configuration with async factories
 * 
 * @example
 * ```typescript
 * // Basic usage
 * @Module({
 *   imports: [
 *     VisionModule.forRoot({
 *       captureRequest: true,
 *       captureMethodExecution: true,
 *       performance: {
 *         trackExecutionTime: true,
 *         slowOperationThreshold: 2000,
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * 
 * // Async configuration
 * @Module({
 *   imports: [
 *     VisionModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (configService: ConfigService) => ({
 *         enabled: configService.get('vision.enabled'),
 *         captureRequest: configService.get('vision.captureRequest'),
 *         excludeRoutes: configService.get('vision.excludeRoutes'),
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class VisionModule {
  /**
   * Configures Vision module with static options.
   * 
   * @param options - Vision configuration options
   * @param withGuard - Whether to enable the optional Vision guard for enhanced security
   * @returns Dynamic module configuration
   */
  static forRoot(options: VisionNestJSOptions = {}, withGuard = false): DynamicModule {
    const providers: Provider[] = [
      {
        provide: VISION_NESTJS_OPTIONS,
        useValue: options,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: VisionInterceptor,
      },
      {
        provide: VISION_SERVICE,
        useValue: vision,
      },
      VisionService,
    ];

    // Add guard if requested
    if (withGuard) {
      providers.push({
        provide: APP_GUARD,
        useClass: VisionGuard,
      });
    }

    return {
      module: VisionModule,
      providers,
      exports: [VISION_SERVICE, VisionService],
      global: true,
    };
  }

  /**
   * Configures Vision module with async options.
   * 
   * @param options - Async configuration options
   * @param withGuard - Whether to enable the optional Vision guard for enhanced security
   * @returns Dynamic module configuration
   */
  static forRootAsync(options: VisionModuleAsyncOptions, withGuard = false): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);
    
    const providers: Provider[] = [
      ...asyncProviders,
      {
        provide: APP_INTERCEPTOR,
        useClass: VisionInterceptor,
      },
      {
        provide: VISION_SERVICE,
        useValue: vision,
      },
      VisionService,
    ];

    // Add guard if requested
    if (withGuard) {
      providers.push({
        provide: APP_GUARD,
        useClass: VisionGuard,
      });
    }

    return {
      module: VisionModule,
      imports: options.imports,
      providers,
      exports: [VISION_SERVICE, VisionService],
      global: options.isGlobal !== false,
    };
  }

  /**
   * Creates a feature module that can be imported into specific modules.
   * This is useful when you want Vision only in certain parts of your application.
   * 
   * @param options - Vision configuration options
   * @returns Dynamic module configuration
   */
  static forFeature(options: VisionNestJSOptions = {}): DynamicModule {
    return {
      module: VisionModule,
      providers: [
        {
          provide: VISION_NESTJS_OPTIONS,
          useValue: options,
        },
        VisionInterceptor,
        VisionService,
        {
          provide: VISION_SERVICE,
          useValue: vision,
        },
      ],
      exports: [VisionInterceptor, VisionService, VISION_SERVICE],
    };
  }

  /**
   * Creates a testing module with Vision configured for test environments.
   * 
   * @param options - Test-specific Vision options
   * @returns Dynamic module configuration
   */
  static forTesting(options: Partial<VisionNestJSOptions> = {}): DynamicModule {
    const testOptions: VisionNestJSOptions = {
      enabled: false, // Disabled by default in tests
      captureRequest: false,
      captureMethodExecution: false,
      performance: {
        trackExecutionTime: false,
        trackMemoryUsage: false,
        slowOperationThreshold: 5000, // Higher threshold for tests
      },
      ...options,
    };

    return this.forRoot(testOptions);
  }

  private static createAsyncProviders(options: VisionModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: VISION_NESTJS_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: VISION_NESTJS_OPTIONS,
          useFactory: async (optionsFactory: VisionOptionsFactory) =>
            optionsFactory.createVisionOptions(),
          inject: [options.useClass],
        },
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: VISION_NESTJS_OPTIONS,
          useFactory: async (optionsFactory: VisionOptionsFactory) =>
            optionsFactory.createVisionOptions(),
          inject: [options.useExisting],
        },
      ];
    }

    throw new Error(
      "Invalid VisionModuleAsyncOptions. Must provide useFactory, useClass, or useExisting.",
    );
  }
}