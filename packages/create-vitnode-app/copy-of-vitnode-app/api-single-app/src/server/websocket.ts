import { defineWebSocketHandler } from "nitro";
import { fetchViteEnv } from "nitro/vite/runtime";

// Nitro's `/api/ws` route (see `vite.config.ts`). It runs in Nitro's bundle and
// hands each handshake to the API embedded in the app's server bundle, so the
// socket gets the same session, Origin check and handlers as a standalone API.
//
// `@vitnode/core` is imported only after that bundle has loaded: Nitro's entry
// stays free of it, and core initialises in the order the app expects.
const warmup = async (request: Request) => fetchViteEnv("ssr", request);

const loadHooks = async (url: string) => {
  await warmup(new Request(url));
  const { createVitNodeWebSocketHooks } =
    await import("@vitnode/core/ws/crossws.server");

  return createVitNodeWebSocketHooks({ warmup });
};

let hooks: ReturnType<typeof loadHooks> | undefined;

export default defineWebSocketHandler(async event => {
  hooks ??= loadHooks(event.req.url);
  try {
    return await hooks;
  } catch (error) {
    hooks = undefined;
    // oxlint-disable-next-line no-console
    console.error("[VitNode] The WebSocket route could not load:", error);

    // Refuse rather than accept a socket nothing would answer; the client retries.
    return {
      upgrade: () =>
        new Response("WebSocket is unavailable.", { status: 503 }),
    };
  }
});
