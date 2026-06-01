import type { Context } from "hono";
import type { WSEvents } from "hono/ws";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { VitNodeWSMessage } from "@/ws/types";

import { wsRegistry } from "@/ws/registry";
import { getWebSocketId } from "@/ws/types";

/**
 * Parse an incoming raw WebSocket message into a {@link VitNodeWSMessage}
 * envelope. Returns `undefined` for anything that is not a JSON object
 * carrying a string `id` (e.g. plain text or binary frames).
 */
const parseMessage = (raw: unknown): undefined | VitNodeWSMessage => {
  if (typeof raw !== "string") return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      typeof (parsed as Record<string, unknown>).id === "string"
    ) {
      return parsed as VitNodeWSMessage;
    }
  } catch {
    /* ignore non-JSON messages */
  }

  return undefined;
};

/**
 * Handle VitNode WebSockets for any Hono runtime that exposes
 * `upgradeWebSocket` (node.js `@hono/node-server`, Bun, ...).
 *
 * A single `/ws` connection is multiplexed across every registered socket.
 * Each message is an envelope `{ id, data }` where `id` is
 * `{pluginId}_{module}_{id}`. On every message this handler looks up the
 * registered WebSocket whose composed id matches and calls its `onMessage`
 * handler with the parsed `data` (and a `send` helper that wraps the reply in
 * the same envelope). The registered handlers receive the request
 * `Context<EnvVitNode>`, so they can reach the database, the authenticated
 * user, the logger, etc.
 *
 * The optional `createEvents` callback lets you add connection-level behavior
 * (`onOpen`, `onClose`, `onError`, or a fallback `onMessage` for messages that
 * do not match any registered socket) with access to the typed context.
 *
 * @example
 * ```ts
 * app.get("/ws", upgradeWebSocket(handleVitNodeWebSocket()));
 * ```
 */
export function handleVitNodeWebSocket(
  createEvents?: (c: Context<EnvVitNode>) => Promise<WSEvents> | WSEvents,
) {
  return async (c: Context<EnvVitNode>): Promise<WSEvents> => {
    const inline = await createEvents?.(c);
    const registered = c.get("core").webSockets;
    // Authenticated from the session cookie sent with the upgrade request, so
    // the server can target this connection's user (e.g. for notifications).
    const userId = c.get("user")?.id ?? null;

    return {
      onOpen: (event, ws) => {
        // Track the connection so the server can push messages to it.
        wsRegistry.add(ws, userId);
        inline?.onOpen?.(event, ws);
      },
      onClose: (event, ws) => {
        wsRegistry.remove(ws);
        inline?.onClose?.(event, ws);
      },
      onError: inline?.onError,
      onMessage: (event, ws) => {
        const message = parseMessage(event.data);
        const target = message
          ? registered.find(
              webSocket => getWebSocketId(webSocket) === message.id,
            )
          : undefined;

        if (message && target) {
          const send = (data: unknown) => {
            ws.send(
              JSON.stringify({
                id: message.id,
                data,
              } satisfies VitNodeWSMessage),
            );
          };

          void target.onMessage({ c, data: message.data, send, ws });

          return;
        }

        // Fall back to the connection-level handler for unmatched messages.
        inline?.onMessage?.(event, ws);
      },
    };
  };
}
