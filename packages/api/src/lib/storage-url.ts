import type { Context } from "hono";

export const storageUrlOf = (
  c: Context,
  key: null | string | undefined,
): null | string => {
  if (!key) return null;

  const adapter = c.get("core")?.storage?.adapter;

  return adapter ? adapter.getUrl(key) : null;
};
