import type { Context } from "hono";
import type { WSEvents } from "hono/ws";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { VitNodeWSMessage } from "@/ws/types";

import { markWebSocketEnabled, wsRegistry } from "@/ws/registry";
import { getWebSocketId } from "@/ws/types";

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

export function handleVitNodeWebSocket(
  createEvents?: (c: Context<EnvVitNode>) => Promise<WSEvents> | WSEvents,
) {
  // Called once at boot when the app mounts `/ws`, so the admin integrations
  // panel can report the WebSocket endpoint as active.
  markWebSocketEnabled();

  return async (c: Context<EnvVitNode>): Promise<WSEvents> => {
    const inline = await createEvents?.(c);
    const registered = c.get("core")?.webSockets ?? [];
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

          try {
            Promise.resolve(
              target.onMessage({ c, data: message.data, send, ws }),
            ).catch((error: unknown) => {
              // eslint-disable-next-line no-console
              console.error("WebSocket handler error:", error);
            });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("WebSocket handler error:", error);
          }

          return;
        }

        // Fall back to the connection-level handler for unmatched messages.
        inline?.onMessage?.(event, ws);
      },
    };
  };
}
