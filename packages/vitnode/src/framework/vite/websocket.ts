import type { Plugin, UserConfig } from "vite";

import { fileURLToPath } from "node:url";

const WEBSOCKET_ROUTE = "/api/ws";
const WEBSOCKET_ROUTE_MODULE = "@vitnode/core/ws/nitro-route";
const CLOUDFLARE_MIDDLEWARE_MODULE =
  "@vitnode/core/cloudflare/nitro-middleware";
const CLOUDFLARE_ENTRY_MODULE = "@vitnode/core/cloudflare/nitro-entry";
const CLOUDFLARE_PRESETS = new Set(["cloudflare-module", "cloudflare_module"]);

/**
 * Where an app that embeds the API serves `/api/ws`:
 *
 * - `true` or `{ transport: "node" }` - from the Node/Bun process, through
 *   Nitro's WebSocket support (crossws). Multiple instances share pushes over
 *   Redis.
 * - `{ transport: "cloudflare" }` - from one Durable Object hub per
 *   installation, on Nitro's `cloudflare-module` preset. `vite dev` still
 *   serves the Node transport; build and preview with Wrangler to run the hub.
 * - `false` - not at all.
 */
export type VitNodeWebSocketOption =
  | boolean
  | { transport: "cloudflare" | "node" };

const resolveModule = (specifier: string): string =>
  fileURLToPath(import.meta.resolve(specifier));

const withNitroWebSocket = (): UserConfig => {
  const handler = resolveModule(WEBSOCKET_ROUTE_MODULE);
  const config: {
    nitro: {
      features: { websocket: true };
      handlers: { handler: string; route: string }[];
      noExternals: string[];
    };
  } = {
    nitro: {
      features: { websocket: true },
      handlers: [{ handler, route: WEBSOCKET_ROUTE }],
      noExternals: [handler],
    },
  };

  return config;
};

const withCloudflareRealtime = (): UserConfig => {
  const middleware = resolveModule(CLOUDFLARE_MIDDLEWARE_MODULE);
  const entry = resolveModule(CLOUDFLARE_ENTRY_MODULE);
  const config: {
    nitro: {
      handlers: { handler: string; middleware: true; route: string }[];
      noExternals: string[];
      serverEntry: string;
    };
  } = {
    nitro: {
      // Global, so it wraps every request in a Cloudflare scope; it answers
      // `/api/ws` upgrades itself by handing them to the hub. Nitro's own
      // WebSocket support stays off: one adapter per upgrade.
      handlers: [{ handler: middleware, middleware: true, route: "/**" }],
      noExternals: [middleware, entry],
      // The preset re-exports the server entry's named exports from the
      // Worker, which is how `VitNodeRealtimeHub` reaches the Durable Object
      // binding. It has no default export, so it serves no request.
      serverEntry: entry,
    },
  };

  return config;
};

const transportOf = (
  webSocket: VitNodeWebSocketOption,
): "cloudflare" | "node" | undefined => {
  if (webSocket === false) return undefined;
  if (webSocket === true) return "node";

  return webSocket.transport;
};

/**
 * Mounts VitNode's WebSocket at `/api/ws`. With the Node transport it is a
 * Nitro route on Nitro's WebSocket support, handing each handshake to the API
 * embedded in the app's server bundle. With the Cloudflare transport it is a
 * Nitro middleware that forwards upgrades to the realtime hub, plus the hub's
 * class exported from the built Worker. Does nothing when `webSocket` is off.
 *
 * @throws At build time, when the Cloudflare transport is selected without
 * Nitro's `cloudflare-module` preset - the hub could not exist at runtime.
 */
export const vitNodeWebSocket = ({
  nitroPreset,
  webSocket = false,
}: {
  /** The Nitro preset passed to `vitnode({ nitro: { preset } })`, if any. */
  nitroPreset?: string;
  webSocket?: VitNodeWebSocketOption;
} = {}): Plugin => ({
  config: (_userConfig, { command }) => {
    const transport = transportOf(webSocket);
    if (!transport) return undefined;
    if (transport === "node") return withNitroWebSocket();

    // `vite dev` runs Nitro on Node, where no Durable Object exists.
    if (command === "serve") return withNitroWebSocket();

    const preset = nitroPreset ?? process.env.NITRO_PRESET;
    if (!preset || !CLOUDFLARE_PRESETS.has(preset)) {
      throw new Error(
        `[VitNode] vitnode({ webSocket: { transport: "cloudflare" } }) needs Nitro's "cloudflare-module" preset, but the build uses ${preset ? `"${preset}"` : "the default preset"}. Set vitnode({ nitro: { preset: "cloudflare-module" } }) or switch the transport back to true.`,
      );
    }

    return withCloudflareRealtime();
  },
  name: "vitnode:websocket",
});
