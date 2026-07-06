import type { Context, Next } from "hono";

// Kept in its own light module (no heavy imports) so `buildRoute` can use it
// without pulling the full global middleware — and its models (StorageModel →
// sharp, etc.) — into bundles that transitively import route definitions.
export const pluginMiddleware = (pluginId: string) => {
  return async (c: Context, next: Next) => {
    c.set("plugin", {
      id: pluginId,
    });
    await next();
  };
};
