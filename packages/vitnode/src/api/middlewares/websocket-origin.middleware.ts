import type { Context, Next } from "hono";

import { HTTPException } from "hono/http-exception";

import { CONFIG } from "@/lib/config";

/** `https://example.com/api/` -> `https://example.com`, or undefined. */
const originOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

/**
 * Refuses a WebSocket upgrade from an origin this install does not serve.
 *
 * ## Why a WebSocket needs its own check
 *
 * The same-origin policy does not apply to `new WebSocket(...)`. Any page on the
 * internet may open a socket to any host, and the browser attaches that host's
 * cookies to the handshake exactly as it would for a same-site request - there
 * is no preflight to refuse it and no CORS header that governs it. So a
 * cookie-authenticated socket is, by default, reachable by every other site the
 * visitor has open: `evil.example` opens `wss://your-site/api/ws`, VitNode reads
 * the session cookie off the handshake, and the connection is registered as that
 * visitor. Everything the server then pushes to them - notifications and
 * whatever else a plugin sends - arrives at the attacker's page instead, and
 * every message the attacker sends is handled as that user.
 *
 * Hono's `csrf()` does not cover this: it inspects non-`GET` requests, and a
 * WebSocket handshake is a `GET`.
 *
 * The `Origin` header is the defence, and it is a sound one here precisely
 * because the browser sets it and a page cannot override it. A handshake that
 * carries **no** `Origin` is allowed through: browsers always send one, so an
 * originless handshake is a non-browser client, which has no cookies to be
 * ridden in the first place.
 */
export const websocketOriginMiddleware = ({
  origin,
}: {
  /**
   * Extra origins allowed to open a socket, beyond the configured web and API
   * origins. Pass the front end's origin when it is not `NEXT_PUBLIC_WEB_URL`.
   */
  origin?: string[];
} = {}) => {
  const allowed = new Set(
    [
      originOf(CONFIG.web.href),
      originOf(CONFIG.api.origin),
      ...(origin ?? []).map(entry => originOf(entry) ?? entry),
    ].filter((entry): entry is string => Boolean(entry)),
  );

  return async (c: Context, next: Next) => {
    const requestOrigin = c.req.header("origin");

    // No `Origin` at all: not a browser, so not a cross-site ride on somebody's
    // cookies. See the note above.
    if (requestOrigin && !allowed.has(requestOrigin)) {
      throw new HTTPException(403, {
        message: "WebSocket connections are not allowed from this origin.",
      });
    }

    await next();
  };
};
