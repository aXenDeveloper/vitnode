import type { WSEvents, WSReadyState } from "hono/ws";

import { defineWebSocketHelper, WSContext } from "hono/ws";

import type { InProcessApiHandler } from "@/lib/fetcher/in-process-api.server";

import { getInProcessApi } from "@/lib/fetcher/in-process-api.server";

// `Symbol.for`, not a module-level symbol: the Hono route below runs in the
// app's server bundle and the hooks in Nitro's, and each bundle has its own
// copy of this module. Both read the same key off the same `Request`.
const HANDSHAKE_KEY = Symbol.for("vitnode.ws.crossws.handshake");

const CONTEXT_KEY = "vitnodeWebSocket";

interface Handshake {
  events?: WSEvents;
}

type HandshakeRequest = Request & { [HANDSHAKE_KEY]?: Handshake };

/**
 * The Hono helper for a `/ws` route served through Nitro (crossws). It does not
 * upgrade anything itself: it hands the connection's events, created after the
 * API's middleware has run, back to {@link createVitNodeWebSocketHooks}, which
 * performs the upgrade. The counterpart of `upgradeWebSocket` from
 * `@hono/node-server` in a standalone API. Server-only.
 *
 * A request that did not come from those hooks - a plain `GET /api/ws` - gets
 * `426 Upgrade Required`.
 *
 * @example
 * ```ts
 * import { websocketOriginMiddleware } from "@vitnode/core/api/middlewares/websocket-origin.middleware";
 * import { upgradeWebSocket } from "@vitnode/core/ws/crossws.server";
 * import { handleVitNodeWebSocket } from "@vitnode/core/ws/handle";
 *
 * app.get(
 *   "/ws",
 *   websocketOriginMiddleware(),
 *   upgradeWebSocket(handleVitNodeWebSocket()),
 * );
 * ```
 */
export const upgradeWebSocket = defineWebSocketHelper((c, events) => {
  const handshake = (c.req.raw as HandshakeRequest)[HANDSHAKE_KEY];
  if (!handshake) return c.text("WebSocket upgrade is required.", 426);

  handshake.events = events;

  return c.body(null, 200);
});

/** The parts of a crossws peer the adapter uses. */
export interface VitNodeCrosswsPeer {
  close: (code?: number, reason?: string) => void;
  readonly context: Record<string, unknown>;
  readonly request: { readonly url: string };
  send: (data: ArrayBuffer | string | Uint8Array) => unknown;
  readonly websocket: {
    readonly protocol?: string;
    readonly readyState?: number;
  };
}

/** The parts of a crossws message the adapter uses. */
export interface VitNodeCrosswsMessage {
  arrayBuffer: () => ArrayBuffer | SharedArrayBuffer;
  readonly rawData: unknown;
}

/** The crossws hooks {@link createVitNodeWebSocketHooks} returns. */
export interface VitNodeCrosswsHooks {
  close: (
    peer: VitNodeCrosswsPeer,
    details: { code?: number; reason?: string },
  ) => void;
  error: (peer: VitNodeCrosswsPeer, error: unknown) => void;
  message: (peer: VitNodeCrosswsPeer, message: VitNodeCrosswsMessage) => void;
  open: (peer: VitNodeCrosswsPeer) => void;
  /** Resolves the rejection as a `Response`, or the accepted connection. */
  upgrade: (request: Request) => Promise<
    | Response
    | {
        context: Record<string, unknown>;
        headers: [string, string][];
      }
  >;
}

export interface VitNodeWebSocketHooksOptions {
  /**
   * The in-process API to authenticate handshakes with. Defaults to the one
   * the app registered with `configureInProcessApi`.
   */
  api?: InProcessApiHandler;
  /**
   * Loads the app's server bundle when no API has registered yet - a cold
   * instance whose first request is a WebSocket upgrade. Receives a plain
   * `GET` for the same URL; its response is ignored. In a Nitro app pass
   * `request => fetchViteEnv("ssr", request)` from `nitro/vite/runtime`.
   */
  warmup?: (request: Request) => Promise<unknown>;
}

interface Connection {
  closed: boolean;
  events: WSEvents;
  ws?: WSContext;
}

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

const connectionOf = (peer: VitNodeCrosswsPeer): Connection | undefined => {
  const connection = peer.context[CONTEXT_KEY];

  return typeof connection === "object" && connection !== null
    ? (connection as Connection)
    : undefined;
};

const clientAddressOf = (request: Request): string | undefined => {
  const ip: unknown = Reflect.get(request, "ip");

  return typeof ip === "string" && ip.length > 0 ? ip : undefined;
};

const closeEvent = (code?: number, reason?: string): CloseEvent => {
  const init = { code, reason, wasClean: code !== undefined && code !== 1006 };
  if (typeof CloseEvent === "function") return new CloseEvent("close", init);

  // Node 22 has no `CloseEvent` global.
  return Object.assign(new Event("close"), init) as CloseEvent;
};

/**
 * Runs the connection's `onClose` exactly once, whether the socket closed, the
 * runtime reported an error, or both - so it leaves the registry and every room
 * once.
 */
const finish = (
  connection: Connection,
  details: { code?: number; reason?: string },
): void => {
  if (connection.closed) return;
  connection.closed = true;
  if (!connection.ws) return;

  try {
    connection.events.onClose?.(
      closeEvent(details.code, details.reason),
      connection.ws,
    );
  } catch (error) {
    logError("WebSocket close handler error:", error);
  }
};

/**
 * crossws hooks that serve VitNode's `/api/ws` from Nitro, for an app that
 * embeds the API (`configureInProcessApi`). Pass them to
 * `defineWebSocketHandler` in a Nitro route. Server-only.
 *
 * Each handshake runs through the embedded Hono app as a `GET /api/ws`, so the
 * Origin check, the rate limiter, the session cookie and every
 * `c.get(...)` model are exactly what a standalone API's handshake gets; the
 * route must use {@link upgradeWebSocket}. Anything but an accepted handshake
 * is returned as the rejection `Response` and nothing is registered. Once open, the
 * connection keeps one `WSContext` for its lifetime and runs the same
 * `handleVitNodeWebSocket` events as `@hono/node-server`.
 *
 * Liveness is the runtime's job: crossws pings and drops silent sockets, and
 * the client sends its own `vitnode_ping`.
 *
 * `vitnode({ webSocket: true })` from `@vitnode/core/framework/vite` already
 * mounts a Nitro route at `/api/ws` that does this; write your own only for a
 * different route. Import this module dynamically there, after the warmup: a
 * static import bundles all of `@vitnode/core` into Nitro's entry, where it
 * starts before the app has configured it.
 *
 * @example
 * ```ts
 * // a custom Nitro route, registered through `vitnode({ nitro: { handlers } })`
 * import { defineWebSocketHandler } from "nitro";
 * import { fetchViteEnv } from "nitro/vite/runtime";
 *
 * const warmup = async (request: Request) => fetchViteEnv("ssr", request);
 *
 * export default defineWebSocketHandler(async event => {
 *   await warmup(new Request(event.req.url));
 *   const { createVitNodeWebSocketHooks } =
 *     await import("@vitnode/core/ws/crossws.server");
 *
 *   return createVitNodeWebSocketHooks({ warmup });
 * });
 * ```
 */
export const createVitNodeWebSocketHooks = ({
  api,
  warmup,
}: VitNodeWebSocketHooksOptions = {}): VitNodeCrosswsHooks => {
  let warming: Promise<unknown> | undefined;

  const resolveApi = async (
    request: Request,
  ): Promise<InProcessApiHandler | undefined> => {
    const current = api ?? getInProcessApi();
    if (current || !warmup) return current;

    warming ??= warmup(new Request(request.url))
      .catch((error: unknown) => {
        logError("WebSocket warmup error:", error);
      })
      .finally(() => {
        warming = undefined;
      });
    await warming;

    return getInProcessApi();
  };

  return {
    close: (peer, details) => {
      const connection = connectionOf(peer);
      if (connection) finish(connection, details);
    },
    error: (peer, error) => {
      logError("WebSocket error:", error);
      const connection = connectionOf(peer);
      if (!connection) return;

      if (connection.ws) {
        try {
          connection.events.onError?.(new Event("error"), connection.ws);
        } catch (handlerError) {
          logError("WebSocket error handler error:", handlerError);
        }
      }
      finish(connection, { code: 1011, reason: "Internal error" });
      try {
        peer.close(1011, "Internal error");
      } catch {
        // Already gone.
      }
    },
    message: (peer, message) => {
      const connection = connectionOf(peer);
      if (!connection?.ws || connection.closed) return;

      const data =
        typeof message.rawData === "string"
          ? message.rawData
          : message.arrayBuffer();
      try {
        connection.events.onMessage?.(
          new MessageEvent("message", { data }),
          connection.ws,
        );
      } catch (error) {
        logError("WebSocket message handler error:", error);
      }
    },
    open: peer => {
      const connection = connectionOf(peer);
      if (!connection) {
        peer.close(1011, "Missing handshake");

        return;
      }

      // One wrapper for the connection's whole life: the registry, the rooms
      // and every handler key their state by this object.
      connection.ws = new WSContext({
        close: (code, reason) => {
          peer.close(code, reason);
        },
        protocol: peer.websocket.protocol,
        raw: peer,
        get readyState() {
          return (peer.websocket.readyState ?? 1) as WSReadyState;
        },
        send: data => {
          peer.send(data);
        },
        url: peer.request.url,
      });

      try {
        connection.events.onOpen?.(new Event("open"), connection.ws);
      } catch (error) {
        logError("WebSocket open handler error:", error);
      }
    },
    upgrade: async request => {
      const handler = await resolveApi(request);
      if (!handler) {
        return new Response("The VitNode API is not available.", {
          status: 503,
        });
      }

      const handshake: Handshake = {};
      const handshakeRequest: HandshakeRequest = new Request(request.url, {
        headers: request.headers,
      });
      handshakeRequest[HANDSHAKE_KEY] = handshake;

      const response = await handler(handshakeRequest, {
        clientAddress: clientAddressOf(request),
      });

      if (!handshake.events || !response.ok) {
        // Origin refused, rate limited, not ready, ... - the API's own answer.
        // crossws sends a returned `Response` back instead of upgrading.
        return response.ok
          ? new Response("WebSocket upgrade failed.", { status: 500 })
          : response;
      }
      await response.body?.cancel();

      return {
        context: {
          [CONTEXT_KEY]: {
            closed: false,
            events: handshake.events,
          } satisfies Connection,
        },
        // A handshake that refreshed the session passes the cookie on.
        headers: response.headers
          .getSetCookie()
          .map((cookie): [string, string] => ["set-cookie", cookie]),
      };
    },
  };
};
