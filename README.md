# @rodrigopsasaki/vision-datadog-exporter

A simple, extensible Datadog exporter for [@rodrigopsasaki/vision](https://github.com/rodrigopsasaki/vision). Ships with sensible defaults: just plug it into Vision and get trace/metric/log/event export to Datadog with all context metadata.

## Features
- 📦 Plug-and-play Vision exporter for Datadog
- 🪄 Sensible defaults: exports Vision context as Datadog span/trace (or metric/log/event)
- 🧩 Extensible: override transformation logic for custom needs
- 🛡️ Type-safe, Zod-validated config
- 🏷️ All Vision context metadata included as tags/fields

## Installation
```sh
pnpm add @rodrigopsasaki/vision-datadog-exporter
# or
yarn add @rodrigopsasaki/vision-datadog-exporter
# or
npm install @rodrigopsasaki/vision-datadog-exporter
```

## Quick Start
```typescript
import { vision } from '@rodrigopsasaki/vision';
import { createDatadogExporter } from '@rodrigopsasaki/vision-datadog-exporter';

vision.init({
  exporters: [
    createDatadogExporter({
      apiKey: 'your-datadog-api-key',
      service: 'my-service',
      env: 'production',
      // Optional: exportMode: 'trace' | 'metric' | 'log' | 'event'
    })
  ]
});

await vision.observe('user.login', async () => {
  vision.set('user_id', 'user123');
  // ...
});
```

## Configuration
All config options are type-safe and Zod-validated. Minimal config:
```typescript
createDatadogExporter({
  apiKey: 'your-datadog-api-key',
  service: 'my-service',
});
```

**Common options:**
- `apiKey` (string, required): Datadog API key
- `service` (string, required): Service name
- `env` (string, optional): Environment
- `exportMode` ("trace" | "metric" | "log" | "event", default: "trace"): What to export
- `includeContextData` (boolean, default: true): Include all Vision context data as tags/fields
- `includeTiming` (boolean, default: true): Include duration
- `includeErrorDetails` (boolean, default: true): Include error info if present
- `tags` (string[], optional): Extra tags for all exports

See `DatadogConfigSchema` in `src/types.ts` for all options.

## Extension
You can extend the transformation logic by subclassing `VisionDatadogTransformer`:
```typescript
import { VisionDatadogTransformer, createDatadogExporter } from '@rodrigopsasaki/vision-datadog-exporter';

class MyTransformer extends VisionDatadogTransformer {
  toSpan(context, error) {
    const span = super.toSpan(context, error);
    span.meta['custom'] = 'value';
    return span;
  }
}

const exporter = createDatadogExporter({
  apiKey: 'key',
  service: 'svc',
  // ...
});
exporter.transformer = new MyTransformer(exporter.config);
```

## Vision Usage Example
```typescript
import { vision } from '@rodrigopsasaki/vision';
import { createDatadogExporter } from '@rodrigopsasaki/vision-datadog-exporter';

vision.init({
  exporters: [createDatadogExporter({ apiKey: '...', service: '...' })]
});

await vision.observe('order.process', async () => {
  vision.set('order_id', '123');
  vision.set('amount', 42);
  // ...
});
```

## License
MIT
