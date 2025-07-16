import type { VisionExporter } from "../core/types";

export const defaultConsoleExporter: VisionExporter = {
  name: "console",
  success: (ctx) => {
    const { id, name, scope, source, timestamp, data } = ctx;
    console.log("[vision] success", {
      id,
      name,
      scope,
      source,
      timestamp,
      data: Object.fromEntries(data.entries()),
    });
  },
  error: (ctx, err) => {
    const { id, name, scope, source, timestamp, data } = ctx;
    console.error("[vision] error", {
      id,
      name,
      scope,
      source,
      timestamp,
      data: Object.fromEntries(data.entries()),
      error: formatError(err),
    });
  },
};

function formatError(err: unknown): unknown {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }

  return typeof err === "object" && err !== null ? err : { error: String(err) };
}
