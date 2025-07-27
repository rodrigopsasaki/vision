# @rodrigopsasaki/vision-express

Express middleware for seamless Vision context integration. Automatically creates structured observability contexts for HTTP requests with comprehensive metadata capture.

## Features

- **Automatic Context Creation**: Every HTTP request gets wrapped in a Vision context
- **Comprehensive Metadata Capture**: Request/response data, headers, timing, errors
- **Smart Data Redaction**: Automatically redacts sensitive information
- **Flexible Configuration**: Opt-in features with sensible defaults
- **Route Exclusion**: Easy way to exclude health checks and metrics endpoints
- **TypeScript Support**: Full type safety with extended Express interfaces
- **Error Handling**: Automatic error capture and context preservation

## Installation

```bash
npm install @rodrigopsasaki/vision-express
npm install @rodrigopsasaki/vision
```

## Quick Start

```typescript
import express from 'express';
import { vision } from '@rodrigopsasaki/vision';
import { createVisionMiddleware } from '@rodrigopsasaki/vision-express';

const app = express();

// Initialize Vision with exporters
vision.init({
  exporters: [
    // Your exporters here
  ]
});

// Add the Vision middleware
app.use(createVisionMiddleware());

// Your routes now have automatic context tracking
app.get('/users/:id', async (req, res) => {
  // Add custom data to the context
  vision.set('user_id', req.params.id);
  vision.set('operation', 'get_user');
  
  const user = await getUser(req.params.id);
  res.json(user);
});
```

## API Reference

### `createVisionMiddleware(options?)`

Creates a Vision Express middleware with custom configuration.

```typescript
import { createVisionMiddleware } from '@rodrigopsasaki/vision-express';

app.use(createVisionMiddleware({
  captureBody: true,
  contextNameGenerator: (req) => `api.${req.method}.${req.path}`,
  extractUser: (req) => req.user,
  shouldExcludeRoute: (req) => req.path.startsWith('/health'),
}));
```

### `createSimpleVisionMiddleware()`

Creates a middleware with minimal, safe configuration.

```typescript
import { createSimpleVisionMiddleware } from '@rodrigopsasaki/vision-express';

app.use(createSimpleVisionMiddleware());
```

### `createComprehensiveVisionMiddleware()`

Creates a middleware that captures all available data (use with caution).

```typescript
import { createComprehensiveVisionMiddleware } from '@rodrigopsasaki/vision-express';

app.use(createComprehensiveVisionMiddleware());
```

## Configuration Options

### Basic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `captureRequestMetadata` | `boolean` | `true` | Capture request metadata |
| `captureResponseMetadata` | `boolean` | `true` | Capture response metadata |
| `captureHeaders` | `boolean` | `true` | Capture request headers |
| `captureBody` | `boolean` | `false` | Capture request body (security risk) |
| `captureQuery` | `boolean` | `true` | Capture query parameters |
| `captureParams` | `boolean` | `true` | Capture URL parameters |
| `captureUserAgent` | `boolean` | `true` | Capture User-Agent header |
| `captureIp` | `boolean` | `true` | Capture client IP address |
| `captureTiming` | `boolean` | `true` | Capture request timing |

### Customization Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contextNameGenerator` | `(req) => string` | `method.path` | Generate context names |
| `shouldExcludeRoute` | `(req) => boolean` | Health checks | Exclude routes from tracking |
| `extractMetadata` | `(req) => object` | `{}` | Extract custom metadata |
| `extractUser` | `(req) => unknown` | `undefined` | Extract user information |
| `extractCorrelationId` | `(req) => string` | Headers | Extract correlation ID |
| `extractTenant` | `(req) => string` | `undefined` | Extract tenant info |

### Security Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `redactSensitiveData` | `boolean` | `true` | Enable data redaction |
| `redactedHeaders` | `string[]` | Sensitive headers | Headers to redact |
| `redactedQueryParams` | `string[]` | Sensitive params | Query params to redact |
| `redactedBodyFields` | `string[]` | Sensitive fields | Body fields to redact |

### Response Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeRequestIdInResponse` | `boolean` | `true` | Add request ID to response headers |
| `requestIdHeader` | `string` | `X-Request-ID` | Header name for request ID |

## Usage Examples

### Basic Usage

```typescript
import express from 'express';
import { vision } from '@rodrigopsasaki/vision';
import { createVisionMiddleware } from '@rodrigopsasaki/vision-express';

const app = express();

// Initialize Vision
vision.init({
  exporters: [
    {
      name: 'console',
      success: (ctx) => console.log('Request completed:', ctx),
      error: (ctx, err) => console.error('Request failed:', ctx, err),
    }
  ]
});

// Add middleware
app.use(createVisionMiddleware());

// Your routes
app.get('/api/users/:id', async (req, res) => {
  vision.set('user_id', req.params.id);
  vision.set('operation', 'get_user');
  
  const user = await getUser(req.params.id);
  res.json(user);
});
```

### Advanced Configuration

```typescript
import express from 'express';
import { createVisionMiddleware } from '@rodrigopsasaki/vision-express';

const app = express();

app.use(createVisionMiddleware({
  // Custom context naming
  contextNameGenerator: (req) => `api.${req.method.toLowerCase()}.${req.route?.path || req.path}`,
  
  // Extract user from authentication middleware
  extractUser: (req) => req.user,
  
  // Extract correlation ID from headers
  extractCorrelationId: (req) => 
    req.headers['x-correlation-id'] as string || 
    req.headers['x-request-id'] as string,
  
  // Extract tenant from subdomain
  extractTenant: (req) => req.subdomains[0],
  
  // Custom metadata extraction
  extractMetadata: (req) => ({
    service: 'user-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
  }),
  
  // Exclude specific routes
  shouldExcludeRoute: (req) => 
    req.path.startsWith('/health') || 
    req.path.startsWith('/metrics'),
  
  // Security settings
  captureBody: false, // Don't capture request bodies
  redactSensitiveData: true,
  redactedHeaders: ['authorization', 'cookie', 'x-api-key'],
  redactedQueryParams: ['token', 'key', 'secret'],
  redactedBodyFields: ['password', 'ssn', 'credit_card'],
}));
```

### Custom Route Exclusion

```typescript
app.use(createVisionMiddleware({
  shouldExcludeRoute: (req) => {
    // Exclude health checks
    if (req.path.includes('/health')) return true;
    
    // Exclude metrics endpoints
    if (req.path.includes('/metrics')) return true;
    
    // Exclude static files
    if (req.path.includes('/static/')) return true;
    
    // Exclude specific API endpoints
    if (req.path === '/api/v1/status') return true;
    
    return false;
  }
}));
```

### Accessing Context in Routes

```typescript
import type { VisionRequest } from '@rodrigopsasaki/vision-express';

app.get('/users/:id', async (req: VisionRequest, res) => {
  // Access the Vision context
  const ctx = req.visionContext;
  console.log('Request ID:', ctx.id);
  
  // Add data to the context
  vision.set('user_id', req.params.id);
  vision.set('operation', 'get_user');
  vision.set('timestamp', new Date().toISOString());
  
  // Add structured data
  vision.merge('request', {
    method: req.method,
    path: req.path,
    query: req.query,
  });
  
  // Add to arrays
  vision.push('events', 'user_lookup_started');
  
  const user = await getUser(req.params.id);
  
  vision.push('events', 'user_lookup_completed');
  vision.set('result_count', 1);
  
  res.json(user);
});
```

### Error Handling

```typescript
app.get('/users/:id', async (req: VisionRequest, res) => {
  try {
    vision.set('user_id', req.params.id);
    
    const user = await getUser(req.params.id);
    
    if (!user) {
      vision.set('error_type', 'user_not_found');
      vision.set('error_code', 'USER_404');
      throw new Error('User not found');
    }
    
    res.json(user);
  } catch (error) {
    // Vision automatically captures the error
    vision.set('error_handled', true);
    res.status(404).json({ error: 'User not found' });
  }
});
```

## Captured Data

The middleware automatically captures the following data:

### Request Data
- HTTP method, URL, path, protocol
- Client IP address
- User-Agent string
- Request headers (with redaction)
- Query parameters (with redaction)
- URL parameters
- Request body (optional, with redaction)
- Correlation ID
- User information (if provided)
- Tenant information (if provided)

### Response Data
- Status code and message
- Response headers
- Timing information (start, end, duration)

### Error Data
- Error name and message
- Stack trace
- Error code
- HTTP status code

## TypeScript Support

The package provides extended Express interfaces:

```typescript
import type { VisionRequest, VisionResponse } from '@rodrigopsasaki/vision-express';

app.get('/users/:id', (req: VisionRequest, res: VisionResponse) => {
  // req.visionContext is available
  const ctx = req.visionContext;
  
  // Add data to context
  vision.set('user_id', req.params.id);
});
```

## Security Considerations

- **Request Bodies**: Disabled by default to prevent logging sensitive data
- **Data Redaction**: Enabled by default for common sensitive fields
- **Custom Redaction**: Configure which fields to redact based on your needs
- **Route Exclusion**: Exclude health checks and metrics endpoints by default

## Best Practices

1. **Initialize Vision First**: Always initialize Vision with exporters before adding the middleware
2. **Use Route Exclusion**: Exclude health checks and metrics endpoints
3. **Configure Redaction**: Review and customize redaction settings for your data
4. **Add Custom Metadata**: Use `extractMetadata` to add service-specific information
5. **Handle Errors Gracefully**: Let Vision capture errors automatically
6. **Use TypeScript**: Leverage the provided types for better development experience

## Integration with Exporters

The middleware works seamlessly with any Vision exporter:

```typescript
import { vision } from '@rodrigopsasaki/vision';
import { createDatadogExporter } from '@rodrigopsasaki/vision-datadog-exporter';

// Initialize with exporters
vision.init({
  exporters: [
    createDatadogExporter({
      apiKey: process.env.DATADOG_API_KEY,
      service: 'my-api',
    })
  ]
});

// Add middleware
app.use(createVisionMiddleware());
```

## License

MIT 