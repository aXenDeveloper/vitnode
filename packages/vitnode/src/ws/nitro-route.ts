import type { EventHandler } from "nitro/h3";

import { defineWebSocketHandler } from "nitro";
import { fetchViteEnv } from "nitro/vite/runtime";

const warmup = async (request: Request) => fetchViteEnv("ssr", request);

const loadHooks = async (url: string) => {
  await warmup(new Request(url));
  const { createVitNodeWebSocketHooks } = await import("./crossws.server");

  return createVitNodeWebSocketHooks({ warmup });
};

let hooks: ReturnType<typeof loadHooks> | undefined;

const vitNodeWebSocketRoute: EventHandler = defineWebSocketHandler(
  async event => {
    hooks ??= loadHooks(event.req.url);
    try {
      return await hooks;
    } catch (error) {
      hooks = undefined;
      // oxlint-disable-next-line no-console
      console.error("[VitNode] The WebSocket route could not load:", error);

      return {
        upgrade: () =>
          new Response("WebSocket is unavailable.", { status: 503 }),
      };
    }
  },
);

export default vitNodeWebSocketRoute;
