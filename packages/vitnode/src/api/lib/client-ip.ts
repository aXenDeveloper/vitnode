import type { Context } from "hono";

/**
 * How many reverse proxies sit between the internet and this API, or `false`
 * when it is reached directly.
 *
 * `true` is shorthand for one hop, which is the ordinary "nginx / Traefik /
 * platform edge in front of the app" deployment.
 */
export type TrustProxyConfig = boolean | number;

/**
 * Used when neither the socket nor a trusted header can name the peer - a test
 * harness, or a runtime that exposes no connection info at all.
 */
const UNKNOWN_CLIENT_IP = "127.0.0.1";

/**
 * The peer address of the TCP connection, read from whichever runtime is
 * hosting the app.
 *
 * This is the only address a client cannot choose for itself, which is what
 * makes it the base case: every header below is something the *sender* wrote.
 * Each runtime exposes it somewhere different and none of them are typed on
 * `Context`, so the shapes are probed rather than imported - importing
 * `@hono/node-server/conninfo` here would tie this package to Node and break
 * the Bun and edge entry points.
 */
const socketAddress = (c: Context): string | undefined => {
  const env: unknown = c.env;
  if (typeof env !== "object" || env === null) return undefined;

  // Node (`@hono/node-server`): the raw `IncomingMessage`.
  const incoming = (env as { incoming?: unknown }).incoming;
  if (typeof incoming === "object" && incoming !== null) {
    const socket = (incoming as { socket?: unknown }).socket;
    if (typeof socket === "object" && socket !== null) {
      const address = (socket as { remoteAddress?: unknown }).remoteAddress;
      if (typeof address === "string" && address.length > 0) return address;
    }
  }

  // Bun: `server.requestIP(request)`.
  const server = (env as { server?: unknown }).server;
  if (typeof server === "object" && server !== null) {
    const requestIP = (server as { requestIP?: unknown }).requestIP;
    if (typeof requestIP === "function") {
      const info: unknown = (
        requestIP as (request: Request) => null | { address?: unknown }
      )(c.req.raw);
      const address =
        typeof info === "object" && info !== null
          ? (info as { address?: unknown }).address
          : undefined;
      if (typeof address === "string" && address.length > 0) return address;
    }
  }

  // Deno: `Deno.ServeHandlerInfo`.
  const remoteAddr = (env as { remoteAddr?: unknown }).remoteAddr;
  if (typeof remoteAddr === "object" && remoteAddr !== null) {
    const hostname = (remoteAddr as { hostname?: unknown }).hostname;
    if (typeof hostname === "string" && hostname.length > 0) return hostname;
  }

  return undefined;
};

/**
 * The address of the client that made this request.
 *
 * ## Why the headers are not simply read
 *
 * `X-Forwarded-For` and its sixteen cousins are request headers, so anybody can
 * send any of them. Taking the first one present - which is what this used to do
 * - hands every caller a free hand in choosing their own identity, and the two
 * things that identity is *for* are the rate limiter's bucket key and the audit
 * trail on a password-reset row. A limiter keyed on a value the attacker picks
 * is not a limiter, and a reset email that reports "requested from 1.2.3.4"
 * because the requester said so is worse than one that reports nothing.
 *
 * So the socket address is the default, and a forwarded header is read **only**
 * when the install says it is behind a proxy, via `security.trustProxy`.
 *
 * ## Why it counts from the right
 *
 * A proxy *appends* the address it saw to `X-Forwarded-For`, so the chain reads
 * oldest-first and the rightmost entry is the one written by the proxy closest
 * to this server - the only entry in the list that a trusted machine vouched
 * for. Anything the client sent arrives to its left, still in the header,
 * indistinguishable from a real hop by content alone.
 *
 * Counting `hops` from the right is what makes that survivable. Behind one
 * proxy, a client sending `X-Forwarded-For: 9.9.9.9` produces
 * `9.9.9.9, <real client>` once the proxy appends, and the entry one from the
 * right is the real client - the forgery is still in the header and is
 * deliberately stepped over. Reading the leftmost entry instead would return
 * `9.9.9.9`, which is the bug this shape exists to prevent.
 */
export const resolveClientIp = (
  c: Context,
  trustProxy: TrustProxyConfig | undefined,
): string => {
  const socket = socketAddress(c);

  if (!trustProxy) return socket ?? UNKNOWN_CLIENT_IP;

  const hops = trustProxy === true ? 1 : Math.max(1, Math.trunc(trustProxy));
  const chain = (c.req.header("x-forwarded-for") ?? "")
    .split(",")
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

  if (chain.length === 0) return socket ?? UNKNOWN_CLIENT_IP;

  // A chain shorter than the configured hop count means a proxy did not append
  // what it was expected to. The leftmost entry is then the least-worst answer,
  // and it is still bounded by however many proxies really did write to it.
  const index = Math.max(0, chain.length - hops);

  return chain[index] ?? socket ?? UNKNOWN_CLIENT_IP;
};

/**
 * Sets `ipAddress` for the rest of the request.
 *
 * Registered **before** the rate limiter rather than inside `globalMiddleware`,
 * because the limiter reads `ipAddress` to build its bucket key and Hono runs
 * middleware in registration order: resolving it later left the limiter keying
 * every request in the deployment on `undefined`, i.e. one shared bucket for the
 * whole site.
 */
export const clientIpMiddleware = (
  trustProxy: TrustProxyConfig | undefined,
) => {
  let warned = false;

  return async (c: Context, next: () => Promise<void>) => {
    const ipAddress = resolveClientIp(c, trustProxy);

    // Some hosts hand Hono a bare `Request` with no connection info at all - the
    // TanStack Start mount calls `app.fetch(request)` directly, and there is no
    // socket behind it. Without a socket *and* without `trustProxy`, every
    // caller resolves to the same fallback, which quietly turns the rate limiter
    // back into one shared bucket for the whole site. That is worth saying out
    // loud once, because nothing else about it is visible.
    if (!warned && !trustProxy && !socketAddress(c)) {
      warned = true;
      // eslint-disable-next-line no-console
      console.warn(
        `\x1b[34m[VitNode]\x1b[0m \x1b[33mCannot see the client's address:\x1b[0m this runtime exposes no connection info, so every request is being rate-limited as ${UNKNOWN_CLIENT_IP}. Set \`trustProxy\` in the API config to the number of proxies in front of this app so \`X-Forwarded-For\` is read instead.`,
      );
    }

    c.set("ipAddress", ipAddress);

    await next();
  };
};
