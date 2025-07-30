import { vision } from "@rodrigopsasaki/vision";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, Optional } from "@nestjs/common";

import { VisionService } from "./service";
import type { VisionExecutionContextType } from "./types";

/**
 * Vision Guard for enhanced security and audit logging.
 * 
 * This guard integrates with NestJS's security pipeline to:
 * - Capture authentication and authorization attempts
 * - Log security-sensitive operations with proper context
 * - Track failed authentication attempts for security monitoring
 * - Provide audit trails for compliance requirements
 * 
 * The guard runs before route handlers and can capture security context
 * that will be available throughout the entire request lifecycle.
 * 
 * @example
 * ```typescript
 * // Enable globally
 * @Module({
 *   imports: [VisionModule.forRoot({}, true)], // Second parameter enables guard
 * })
 * export class AppModule {}
 * 
 * // Or use on specific controllers
 * @Controller('admin')
 * @UseGuards(VisionGuard)
 * export class AdminController {
 *   @Get('users')
 *   getUsers() {
 *     // Vision context will include security information
 *     return this.usersService.findAll();
 *   }
 * }
 * 
 * // Or on specific routes
 * @Controller('api')
 * export class APIController {
 *   @Get('sensitive-data')
 *   @UseGuards(VisionGuard)
 *   getSensitiveData() {
 *     // Enhanced security logging for this endpoint
 *     return this.dataService.getSensitiveData();
 *   }
 * }
 * ```
 */
@Injectable()
export class VisionGuard implements CanActivate {
  constructor(@Optional() private readonly visionService?: VisionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Capture security-relevant information early in the request lifecycle
      this.captureSecurityContext(context);
      return true; // This guard doesn't block requests, it only captures context
    } catch (error) {
      // Log guard errors but don't block the request
      console.warn("[Vision Guard] Error capturing security context:", error);
      
      // Still capture the error in Vision context if possible
      try {
        vision.set("guard_error", {
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Ignore nested errors
      }
      
      return true;
    }
  }

  private captureSecurityContext(context: ExecutionContext): void {
    const contextType = context.getType<VisionExecutionContextType>();
    
    // Mark this as a security-monitored operation
    vision.set("security_monitored", true);
    vision.set("security_guard_timestamp", new Date().toISOString());

    switch (contextType) {
      case "http":
        this.captureHttpSecurityContext(context);
        break;
      case "graphql":
        this.captureGraphQLSecurityContext(context);
        break;
      case "ws":
        this.captureWebSocketSecurityContext(context);
        break;
      case "rpc":
        this.captureMicroserviceSecurityContext(context);
        break;
    }
  }

  private captureHttpSecurityContext(context: ExecutionContext): void {
    try {
      const request = context.switchToHttp().getRequest();
      
      const securityInfo: Record<string, unknown> = {
        ip_address: this.getClientIP(request),
        user_agent: request.headers?.["user-agent"],
        origin: request.headers?.origin,
        referer: request.headers?.referer,
        forwarded_for: request.headers?.["x-forwarded-for"],
        real_ip: request.headers?.["x-real-ip"],
      };

      // Capture authentication information (without sensitive data)
      if (request.user) {
        securityInfo.authenticated = true;
        securityInfo.user_id = request.user.id || request.user.sub || request.user.userId;
        securityInfo.user_roles = request.user.roles || request.user.role;
        securityInfo.user_permissions = request.user.permissions;
        
        // Capture additional user context if available
        if (request.user.email) {
          securityInfo.user_email = request.user.email;
        }
        
        if (request.user.organizationId) {
          securityInfo.organization_id = request.user.organizationId;
        }
      } else {
        securityInfo.authenticated = false;
        
        // Check for authentication attempts
        const authHeader = request.headers?.authorization;
        if (authHeader) {
          securityInfo.auth_attempt = true;
          securityInfo.auth_type = authHeader.split(" ")[0]?.toLowerCase();
        }
      }

      // Capture API key usage
      const apiKey = request.headers?.["x-api-key"] || request.headers?.["api-key"];
      if (apiKey) {
        securityInfo.api_key_used = true;
        securityInfo.api_key_prefix = apiKey.substring(0, 8) + "..."; // Only log prefix
      }

      // Capture session information
      if (request.session) {
        securityInfo.session_id = request.sessionID;
        securityInfo.session_authenticated = !!request.session.user;
      }

      // Capture CSRF token presence
      const csrfToken = request.headers?.["x-csrf-token"] || request.body?._csrf;
      if (csrfToken) {
        securityInfo.csrf_token_present = true;
      }

      // Detect potentially suspicious patterns
      this.detectSuspiciousPatterns(request, securityInfo);

      vision.merge("security", securityInfo);
    } catch (error) {
      console.warn("[Vision Guard] Error capturing HTTP security context:", error);
    }
  }

  private captureGraphQLSecurityContext(context: ExecutionContext): void {
    try {
      const gqlContext = context.getArgs()[2];
      
      if (gqlContext?.req) {
        // GraphQL requests often come through HTTP, so we can reuse HTTP logic
        const httpContext = { ...context, switchToHttp: () => ({ getRequest: () => gqlContext.req }) };
        this.captureHttpSecurityContext(httpContext as ExecutionContext);
        
        // Add GraphQL-specific security information
        const securityInfo: Record<string, unknown> = {
          graphql_operation: true,
          operation_depth: this.calculateGraphQLDepth(context.getArgs()[3]),
        };
        
        vision.merge("security", securityInfo);
      }
    } catch (error) {
      console.warn("[Vision Guard] Error capturing GraphQL security context:", error);
    }
  }

  private captureWebSocketSecurityContext(context: ExecutionContext): void {
    try {
      const client = context.switchToWs().getClient();
      
      const securityInfo: Record<string, unknown> = {
        websocket_connection: true,
        client_id: client.id,
      };

      // Capture handshake security information
      if (client.handshake) {
        securityInfo.handshake_address = client.handshake.address;
        securityInfo.handshake_origin = client.handshake.headers?.origin;
        securityInfo.handshake_user_agent = client.handshake.headers?.["user-agent"];
        
        // Check for authentication in handshake
        if (client.handshake.auth) {
          securityInfo.websocket_authenticated = !!client.handshake.auth.user;
        }
      }

      vision.merge("security", securityInfo);
    } catch (error) {
      console.warn("[Vision Guard] Error capturing WebSocket security context:", error);
    }
  }

  private captureMicroserviceSecurityContext(context: ExecutionContext): void {
    try {
      const rpcContext = context.switchToRpc().getContext();
      
      const securityInfo: Record<string, unknown> = {
        microservice_message: true,
        message_pattern: rpcContext?.pattern || rpcContext?.cmd,
      };

      // Capture any authentication context passed in the message
      if (rpcContext?.user) {
        securityInfo.message_authenticated = true;
        securityInfo.message_user_id = rpcContext.user.id || rpcContext.user.sub;
      }

      vision.merge("security", securityInfo);
    } catch (error) {
      console.warn("[Vision Guard] Error capturing microservice security context:", error);
    }
  }

  private getClientIP(request: any): string {
    return (
      request.ip ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      request.headers?.["x-real-ip"] ||
      "unknown"
    );
  }

  private detectSuspiciousPatterns(request: any, securityInfo: Record<string, unknown>): void {
    const suspiciousPatterns: string[] = [];
    
    // Check for suspicious user agents
    const userAgent = request.headers?.["user-agent"]?.toLowerCase() || "";
    if (userAgent.includes("bot") || userAgent.includes("crawler") || userAgent.includes("spider")) {
      suspiciousPatterns.push("bot_user_agent");
    }

    // Check for suspicious IP patterns (basic check)
    const ip = this.getClientIP(request);
    if (ip.startsWith("127.") || ip.startsWith("::1") || ip === "unknown") {
      suspiciousPatterns.push("local_or_unknown_ip");
    }

    // Check for potential SQL injection patterns in query params
    const queryString = JSON.stringify(request.query || {}).toLowerCase();
    if (queryString.includes("union") || queryString.includes("select") || queryString.includes("drop")) {
      suspiciousPatterns.push("potential_sql_injection");
    }

    // Check for potential XSS patterns
    if (queryString.includes("<script") || queryString.includes("javascript:")) {
      suspiciousPatterns.push("potential_xss");
    }

    // Check for unusual request frequency (this would require state management)
    // For now, we'll just mark high-frequency endpoints
    if (request.headers?.["x-forwarded-for"]?.split(",").length > 3) {
      suspiciousPatterns.push("multiple_proxy_hops");
    }

    if (suspiciousPatterns.length > 0) {
      securityInfo.suspicious_patterns = suspiciousPatterns;
      securityInfo.security_alert = true;
    }
  }

  private calculateGraphQLDepth(info: any): number {
    if (!info?.fieldNodes?.[0]?.selectionSet) {
      return 0;
    }

    function getDepth(selectionSet: any, currentDepth = 1): number {
      let maxDepth = currentDepth;
      
      for (const selection of selectionSet.selections || []) {
        if (selection.selectionSet) {
          const depth = getDepth(selection.selectionSet, currentDepth + 1);
          maxDepth = Math.max(maxDepth, depth);
        }
      }
      
      return maxDepth;
    }

    return getDepth(info.fieldNodes[0].selectionSet);
  }
}