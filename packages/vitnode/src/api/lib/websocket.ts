import type { Context } from "hono";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import type { WSContext } from "hono/ws";

export type WebsocketAdapter = (c: Context) => {
  onOpen: () => void;
};

const test = upgradeWebSocket(c => {
  const wsManager = c.get("core").websocketManager;

  return {
    onOpen(evt: Event, ws: WSContext) {
      const user = c.get("user");
      console.log("Connection opened", user);
    },
    onMessage(event, ws) {
      console.log(`Message from client: ${event.data}`);
      ws.send("Hello from server!");
    },
    onClose: () => {
      console.log("Connection closed");
    },
  };
});
