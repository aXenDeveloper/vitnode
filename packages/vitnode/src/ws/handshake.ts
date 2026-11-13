import type { ExecutionContext } from "hono";
import type { WSEvents, WSReadyState } from "hono/ws";

import { WSContext } from "hono/ws";

import type { InProcessApiHandler } from "@/lib/fetcher/in-process-api.server";

/**
 * The key the `upgradeWebSocket` helper of `ws/crossws.server` reads the
 * handshake from. `Symbol.for`, not a module-level symbol: the Hono route runs
 * in the app's server bundle and the code that started the handshake may run
 * in Nitro's, and each bundle has its own copy of this module. Both read the
 * same key off the same `Request` - inside one execution, never across a
 * Worker/Durable Object boundary.
 */
export const HANDSHAKE_KEY = Symbol.for("vitnode.ws.crossws.handshake");

/** What the Hono route hands back: the connection's events, once accepted. */
export interface VitNodeHandshake {
  /**
   * The names of the cookies that authenticate a handshake - the session,
   * device and admin cookies. A host that has to replay the handshake later
   * (a hibernated Cloudflare hub) keeps only these.
   */
  cookieNames?: string[];
  events?: WSEvents;
}

const IDENTITY_KEY = Symbol.for("vitnode.ws.connection-identity");

/** Who a connection was authenticated as, as `handleVitNodeWebSocket` saw it. */
export interface VitNodeConnectionIdentity {
  deviceId: null | number;
  userId: null | number;
}

/**
 * Tags a connection's events with the identity its handshake resolved, so a
 * host that replays the handshake can tell whether the session behind the
 * socket changed meanwhile. Returns `events`.
 */
export const withConnectionIdentity = <T extends WSEvents>(
  events: T,
  identity: VitNodeConnectionIdentity,
): T => Object.assign(events, { [IDENTITY_KEY]: identity });

/** The identity {@link withConnectionIdentity} tagged `events` with, if any. */
export const connectionIdentityOf = (
  events: WSEvents,
): undefined | VitNodeConnectionIdentity =>
  (events as WSEvents & { [IDENTITY_KEY]?: VitNodeConnectionIdentity })[
    IDENTITY_KEY
  ];

export type VitNodeHandshakeRequest = Request & {
  [HANDSHAKE_KEY]?: VitNodeHandshake;
};

/** An accepted handshake: the connection's events and the headers to answer with. */
export interface VitNodeAcceptedHandshake {
  /** See {@link VitNodeHandshake.cookieNames}; empty when the route set none. */
  cookieNames: string[];
  events: WSEvents;
  /** `Set-Cookie` values the handshake produced - a refreshed session. */
  setCookies: string[];
}

/**
 * Runs a WebSocket handshake through the embedded API as a `GET` of the same
 * URL, so the Origin check, the rate limiter, the session cookie and every
 * `c.get(...)` model behave exactly as for any request. Resolves the accepted
 * handshake, or the API's own rejection `Response` (`403`, `429`, `503`, ...)
 * - nothing is registered for a rejected one. Server-only.
 *
 * The route must use `upgradeWebSocket` from `@vitnode/core/ws/crossws.server`.
 */
export const runVitNodeHandshake = async (
  api: InProcessApiHandler,
  request: Request,
  {
    clientAddress,
    executionCtx,
  }: { clientAddress?: string; executionCtx?: ExecutionContext } = {},
): Promise<Response | VitNodeAcceptedHandshake> => {
  const handshake: VitNodeHandshake = {};
  const handshakeRequest: VitNodeHandshakeRequest = new Request(request.url, {
    headers: request.headers,
  });
  handshakeRequest[HANDSHAKE_KEY] = handshake;

  const response = await api(handshakeRequest, { clientAddress }, executionCtx);

  if (!handshake.events || !response.ok) {
    // Origin refused, rate limited, not ready, ... - the API's own answer.
    return response.ok
      ? new Response("WebSocket upgrade failed.", { status: 500 })
      : response;
  }
  await response.body?.cancel();

  return {
    cookieNames: handshake.cookieNames ?? [],
    events: handshake.events,
    setCookies: response.headers.getSetCookie(),
  };
};

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

const closeEvent = (code?: number, reason?: string): CloseEvent => {
  const init = { code, reason, wasClean: code !== undefined && code !== 1006 };
  if (typeof CloseEvent === "function") return new CloseEvent("close", init);

  // Node 22 has no `CloseEvent` global.
  return Object.assign(new Event("close"), init) as CloseEvent;
};

/** The runtime socket a {@link VitNodeConnection} drives. */
export interface VitNodeRawSocket {
  close: (code?: number, reason?: string) => void;
  protocol?: string;
  readonly readyState: number;
  send: (data: ArrayBuffer | string | Uint8Array) => void;
  url: string;
}

/**
 * One accepted connection's lifecycle over a runtime socket: one `WSContext`
 * for its whole life (the registry, the rooms and every handler key their
 * state by it), `onOpen` once, and `onClose` exactly once whether the socket
 * closed, the runtime reported an error, or both. Handler errors are logged,
 * never thrown into the runtime. Server-only.
 */
export interface VitNodeConnection {
  /** Runs `onClose` unless it already ran. */
  close: (details: { code?: number; reason?: string }) => void;
  /** Whether `onClose` already ran. */
  readonly closed: boolean;
  /**
   * Reports a runtime error: `onError`, then `onClose` with `1011`, then
   * closes the socket.
   */
  error: (error: unknown) => void;
  /** Passes one frame to `onMessage`. */
  message: (data: ArrayBuffer | string) => void;
  /**
   * Creates the `WSContext` - or uses `existing`, when the host created it
   * already - and runs `onOpen`, once.
   */
  open: (socket: VitNodeRawSocket, raw?: unknown, existing?: WSContext) => void;
  /**
   * Binds the connection to an existing `WSContext` without running `onOpen`:
   * a socket that opened before its host hibernated, whose handlers were
   * rebuilt by replaying the handshake. Registry and rooms already know `ws`.
   */
  resume: (ws: WSContext, socket: VitNodeRawSocket) => void;
  /** The connection's `WSContext`, once opened. */
  readonly ws: undefined | WSContext;
}

/** Creates the {@link VitNodeConnection} for an accepted handshake's events. */
export const createVitNodeConnection = (
  events: WSEvents,
): VitNodeConnection => {
  let ws: undefined | WSContext;
  let socket: undefined | VitNodeRawSocket;
  let closed = false;

  const close: VitNodeConnection["close"] = ({ code, reason }) => {
    if (closed) return;
    closed = true;
    if (!ws) return;

    try {
      events.onClose?.(closeEvent(code, reason), ws);
    } catch (error) {
      logError("WebSocket close handler error:", error);
    }
  };

  return {
    close,
    get closed() {
      return closed;
    },
    error: error => {
      logError("WebSocket error:", error);
      if (ws && !closed) {
        try {
          events.onError?.(new Event("error"), ws);
        } catch (handlerError) {
          logError("WebSocket error handler error:", handlerError);
        }
      }
      close({ code: 1011, reason: "Internal error" });
      try {
        socket?.close(1011, "Internal error");
      } catch {
        // Already gone.
      }
    },
    message: data => {
      if (!ws || closed) return;
      try {
        events.onMessage?.(new MessageEvent("message", { data }), ws);
      } catch (error) {
        logError("WebSocket message handler error:", error);
      }
    },
    resume: (existing, target) => {
      if (ws || closed) return;
      socket = target;
      ws = existing;
    },
    open: (target, raw = target, existing) => {
      if (ws || closed) return;
      socket = target;
      ws =
        existing ??
        new WSContext({
          close: (code, reason) => {
            target.close(code, reason);
          },
          protocol: target.protocol,
          raw,
          get readyState() {
            return target.readyState as WSReadyState;
          },
          send: data => {
            target.send(data);
          },
          url: target.url,
        });

      try {
        events.onOpen?.(new Event("open"), ws);
      } catch (error) {
        logError("WebSocket open handler error:", error);
      }
    },
    get ws() {
      return ws;
    },
  };
};
