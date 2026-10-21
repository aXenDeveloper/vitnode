import type { Plugin, UserConfig } from "vite";

import { fileURLToPath } from "node:url";

const WEBSOCKET_ROUTE = "/api/ws";
const WEBSOCKET_ROUTE_MODULE = "@vitnode/core/ws/nitro-route";

interface NitroWebSocketConfig {
  nitro: {
    features: { websocket: true };
    handlers: { handler: string; route: string }[];
    noExternals: string[];
  };
}

const withNitroWebSocket = (): UserConfig => {
  const handler = fileURLToPath(import.meta.resolve(WEBSOCKET_ROUTE_MODULE));
  const config: NitroWebSocketConfig = {
    nitro: {
      features: { websocket: true },
      handlers: [{ handler, route: WEBSOCKET_ROUTE }],
      noExternals: [handler],
    },
  };

  return config;
};

/**
 * Mounts VitNode's WebSocket at `/api/ws` as a Nitro route and turns on
 * Nitro's WebSocket support. The route hands each handshake to the API
 * embedded in the app's server bundle, and is always bundled into Nitro's
 * output, so it reaches Nitro's runtime in a prerender and in `vite dev` too.
 * Does nothing when `webSocket` is off.
 */
export const vitNodeWebSocket = ({
  webSocket = false,
}: {
  webSocket?: boolean;
} = {}): Plugin => ({
  config: () => (webSocket ? withNitroWebSocket() : undefined),
  name: "vitnode:websocket",
});
