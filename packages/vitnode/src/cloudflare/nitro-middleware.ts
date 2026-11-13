import { runInRealtimeScope } from "@/ws/runtime";

import type { CloudflareEnv, CloudflareExecutionContext } from "./types";

import {
  createCloudflareEdgeScope,
  forwardWebSocketToHub,
  isWebSocketUpgrade,
} from "./edge";

const WEBSOCKET_PATH = "/api/ws";

interface CloudflareRequest extends Request {
  runtime?: {
    cloudflare?: { context?: CloudflareExecutionContext; env?: CloudflareEnv };
  };
}

interface NitroEvent {
  req: CloudflareRequest;
  url: URL;
}

const envOf = (request: CloudflareRequest): CloudflareEnv | undefined =>
  request.runtime?.cloudflare?.env ??
  (globalThis as typeof globalThis & { __env__?: CloudflareEnv }).__env__;

/**
 * Nitro middleware for an app served by Nitro's `cloudflare-module` preset with
 * `vitnode({ webSocket: { transport: "cloudflare" } })`, which registers it.
 *
 * - `GET /api/ws` with `Upgrade: websocket` goes to the installation's
 *   realtime hub and nowhere else, so no other adapter competes for it.
 * - Every other request runs inside a Cloudflare scope, so `c.get("realtime")`,
 *   the `realtime` import and `scopedDatabase` resolve to this invocation and
 *   its hub.
 *
 * Cloudflare Workers only.
 */
const vitNodeCloudflareMiddleware = async (
  event: NitroEvent,
  next: () => unknown,
): Promise<unknown> => {
  const env = envOf(event.req);
  if (!env) {
    // oxlint-disable-next-line no-console
    console.error(
      "[VitNode] No Cloudflare bindings on this request; is the app built with Nitro's cloudflare-module preset?",
    );

    return await next();
  }

  if (event.url.pathname === WEBSOCKET_PATH && isWebSocketUpgrade(event.req)) {
    return await forwardWebSocketToHub(event.req, env);
  }

  const scope = createCloudflareEdgeScope({
    ctx: event.req.runtime?.cloudflare?.context,
    env,
  });

  return await runInRealtimeScope(scope, async () => await next());
};

export default vitNodeCloudflareMiddleware;
