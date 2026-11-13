import type { Context } from "hono";
import type { WSContext, WSEvents } from "hono/ws";

import { HTTPException } from "hono/http-exception";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { NotificationStateMessage } from "@/lib/notifications/types";
import type { RealtimeRuntime } from "@/ws/runtime";
import type { VitNodeWSMessage } from "@/ws/types";

import { DeviceModel } from "@/api/models/device";
import { getNotificationState } from "@/api/models/notifications/inbox";
import { withConnectionIdentity } from "@/ws/handshake";
import { notificationsStateChannel } from "@/ws/notifications";
import { markWebSocketEnabled } from "@/ws/registry";
import { currentRealtimeRuntime, currentRealtimeScope } from "@/ws/runtime";
import { getWebSocketId, WS_PING_ID, WS_PONG_ID } from "@/ws/types";

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

/**
 * Keeps async socket work alive where the runtime asks for it (a Cloudflare
 * hub's `waitUntil`), and logs its failure instead of losing it.
 */
const track = (task: Promise<unknown>, label: string): void => {
  const settled = task.catch((error: unknown) => {
    logError(label, error);
  });
  currentRealtimeScope()?.keepAlive?.(settled);
};

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
  // The socket may have closed while the state was read.
  if (ws.readyState !== 1) return;
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
 * matching `buildWebSocket` handler by id. The protocol is the same whichever
 * runtime performs the upgrade - `@hono/node-server` in a standalone API, or
 * Nitro through `@vitnode/core/ws/crossws` in a single app.
 *
 * The handshake runs through the API's middleware like any request, so the
 * session cookie decides the user (`null` for a guest) and the Hono context
 * stays available to every handler for the connection's lifetime. The
 * connection belongs to the realtime runtime that accepted the handshake: the
 * Node/Bun process, or the installation's Cloudflare hub. With Redis
 * configured it answers `503` until this instance is subscribed to the
 * realtime channel, so no socket is accepted that other instances cannot reach.
 *
 * Server-only. Call it once where the API mounts WebSockets.
 *
 * @param createEvents Optional connection-level handlers. Their `onMessage`
 * only receives messages that matched no registered socket.
 * @param options.runtime The runtime that owns accepted connections. Defaults
 * to the one current at the handshake - right for Node/Bun and the Cloudflare
 * hub; pass it only to pin connections to a runtime you created yourself.
 *
 * @example
 * ```ts
 * import { upgradeWebSocket } from "@hono/node-server";
 * import { websocketOriginMiddleware } from "@vitnode/core/api/middlewares/websocket-origin.middleware";
 * import { handleVitNodeWebSocket } from "@vitnode/core/ws/handle";
 *
 * app.get(
 *   "/ws",
 *   websocketOriginMiddleware(),
 *   upgradeWebSocket(handleVitNodeWebSocket()),
 * );
 * ```
 */
export function handleVitNodeWebSocket(
  createEvents?: (c: Context<EnvVitNode>) => Promise<WSEvents> | WSEvents,
  options: { runtime?: () => RealtimeRuntime } = {},
) {
  // Called once at boot when the app mounts `/ws`, so the admin integrations
  // panel can report the WebSocket endpoint as active.
  markWebSocketEnabled();
  const resolveRuntime = options.runtime ?? currentRealtimeRuntime;

  return async (c: Context<EnvVitNode>): Promise<WSEvents> => {
    const runtime = resolveRuntime();
    if (!(await runtime.ready())) {
      throw new HTTPException(503, {
        message: "Realtime is not ready on this instance yet.",
      });
    }
    const inline = await createEvents?.(c);
    const registered = c.get("core")?.webSockets ?? [];
    // Authenticated from the session cookie sent with the upgrade request, so
    // the server can target this connection's user (e.g. for notifications).
    const userId = c.get("user")?.id ?? null;
    const deviceId =
      userId === null
        ? null
        : ((await new DeviceModel(c).getExistingDeviceId())?.id ?? null);

    return withConnectionIdentity(
      {
        onOpen: (event, ws) => {
          const { registry } = runtime;
          if (!registry) {
            // Only a runtime that owns sockets may accept one; anything else is
            // a misconfigured route.
            logError(
              "WebSocket opened outside a socket host:",
              new Error(`The ${runtime.kind} runtime owns no sockets.`),
            );
            ws.close(1011, "Realtime host unavailable");

            return;
          }
          // Track the connection so the server can push messages to it.
          registry.add(ws, userId, deviceId);
          if (userId !== null) {
            track(
              sendNotificationState(c, ws, userId),
              "WebSocket notification state error:",
            );
          }
          inline?.onOpen?.(event, ws);
        },
        onClose: (event, ws) => {
          runtime.registry?.remove(ws);
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
              track(
                Promise.resolve(
                  target.onMessage({ c, data: message.data, send, ws }),
                ),
                "WebSocket handler error:",
              );
            } catch (error) {
              logError("WebSocket handler error:", error);
            }

            return;
          }

          // Fall back to the connection-level handler for unmatched messages.
          inline?.onMessage?.(event, ws);
        },
      },
      { deviceId, userId },
    );
  };
}
