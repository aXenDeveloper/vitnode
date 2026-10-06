import type { MiddlewareHandler } from "hono";

/**
 * Billing responses are one person's records. A shared cache keyed on the URL
 * must never store one and hand it to the next visitor, and neither should the
 * browser's back/forward cache keep a stale "awaiting payment".
 */
const PRIVATE_NO_STORE = "private, no-store";

export const privateResponse: MiddlewareHandler = async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", PRIVATE_NO_STORE);
};
