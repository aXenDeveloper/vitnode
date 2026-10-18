import type { Context } from "hono";
import type { WSContext, WSEvents } from "hono/ws";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { NotificationStateMessage } from "@/lib/notifications/types";
import type { VitNodeWSMessage } from "@/ws/types";

import { getNotificationState } from "@/api/models/notifications/inbox";
import { notificationsStateChannel } from "@/ws/notifications";
import { markWebSocketEnabled, wsRegistry } from "@/ws/registry";
import { getWebSocketId, WS_PING_ID, WS_PONG_ID } from "@/ws/types";

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

const sendNotificationState = async (
  c: Context<EnvVitNode>,
  ws: WSContext,
  userId: number,
): Promise<void> => {
  const state = await getNotificationState(c.get("db"), userId);
  ws.send(
    JSON.stringify({
      data: { ...state, reason: "reconciled" },
      id: notificationsStateChannel.id,
    } satisfies VitNodeWSMessage<NotificationStateMessage>),
  );
};

/**
 * Builds the Hono `upgradeWebSocket` handler for the app's `/ws` route: tracks
 * each connection with its signed-in user and routes incoming messages to the
 * matching `buildWebSocket` handler by id.
 *
 * Server-only. Call it once where the API mounts WebSockets.
 *
 * @param createEvents Optional connection-level handlers. Their `onMessage`
 * only receives messages that matched no registered socket.
 */
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
        if (userId !== null) {
          sendNotificationState(c, ws, userId).catch((error: unknown) => {
            // oxlint-disable-next-line no-console
            console.error("WebSocket notification state error:", error);
          });
        }
        inline?.onOpen?.(event, ws);
      },
      onClose: (event, ws) => {
        wsRegistry.remove(ws);
        inline?.onClose?.(event, ws);
      },
      onError: inline?.onError,
      onMessage: (event, ws) => {
        const message = parseMessage(event.data);
        if (message?.id === WS_PING_ID) {
          ws.send(
            JSON.stringify({
              data: null,
              id: WS_PONG_ID,
            } satisfies VitNodeWSMessage),
          );

          return;
        }
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
              // oxlint-disable-next-line no-console
              console.error("WebSocket handler error:", error);
            });
          } catch (error) {
            // oxlint-disable-next-line no-console
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
