import type { RealtimeDeliveryCommand } from "@/ws/realtime";
import type {
  RealtimeRuntime,
  RealtimeScope,
  ScopedResource,
} from "@/ws/runtime";

import { realtimeFromCommands } from "@/ws/realtime";
import {
  createServiceStore,
  RealtimeConfigurationError,
  requireRealtimeScope,
  runInRealtimeScope,
} from "@/ws/runtime";

import type { VitNodeHubCommand, VitNodeHubTarget } from "./protocol";
import type { CloudflareEnv, CloudflareExecutionContext } from "./types";

import {
  mergeHostResults,
  VITNODE_CLIENT_IP_HEADER,
  VITNODE_HUB_MAX_BATCH,
  VITNODE_HUB_NAME_HEADER,
  vitNodeHubTargets,
} from "./protocol";

/** How code outside a request or socket event opens a Cloudflare scope. */
const SCOPE_HINT =
  "Requests and socket events get one automatically; wrap scheduled jobs, queue consumers and other background work in runWithVitNodeCloudflare(env, ctx, fn) from @vitnode/core/cloudflare/edge.";

/**
 * Marks this isolate as a Cloudflare deployment: every realtime call must run
 * inside a scope from here on, and the Node-only Redis bridge stays off.
 * Called when the Cloudflare integration loads.
 */
export const markCloudflareRealtime = (): void => {
  requireRealtimeScope({ hint: SCOPE_HINT, name: "Cloudflare Workers" });
};

markCloudflareRealtime();

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

/**
 * Splits a batch into commands the hub accepts, so a large `sendToUsers`
 * reaches it as several bounded RPCs instead of one it would refuse.
 */
const toHubCommands = (
  command: RealtimeDeliveryCommand,
): VitNodeHubCommand[] => {
  if (
    command.type !== "sendToUsers" ||
    command.messages.length <= VITNODE_HUB_MAX_BATCH
  ) {
    return [command];
  }

  const chunks: VitNodeHubCommand[] = [];
  for (
    let start = 0;
    start < command.messages.length;
    start += VITNODE_HUB_MAX_BATCH
  ) {
    chunks.push({
      ...command,
      messages: command.messages.slice(start, start + VITNODE_HUB_MAX_BATCH),
    });
  }

  return chunks;
};

const noop = () => () => {};

/**
 * Sends `command` to every hub in `targets`, keeping each RPC alive with
 * `keepAlive` and logging - never throwing or retrying - a failed one. Shared
 * by the Worker runtime and by shards relaying to their peers.
 */
export const dispatchToHubs = (
  targets: VitNodeHubTarget[],
  command: VitNodeHubCommand,
  keepAlive: (task: Promise<unknown>) => void,
): void => {
  const parts =
    command.type === "host" || command.type === "instance"
      ? [command]
      : toHubCommands(command);
  for (const { name, stub } of targets) {
    for (const part of parts) {
      const task = stub.dispatch(part).catch((error: unknown) => {
        logError(
          `[VitNode] Realtime ${part.type} did not reach the hub "${name}":`,
          error,
        );
      });
      keepAlive(task);
    }
  }
};

/** Runs a host command on every hub in `targets` and merges the results. */
export const runHostCommandOn = async (
  targets: VitNodeHubTarget[],
  name: string,
  payload: unknown,
): Promise<unknown> =>
  mergeHostResults(
    await Promise.all(
      targets.map(
        async ({ stub }) =>
          await stub.dispatch({
            name,
            payload,
            type: "host",
          } satisfies VitNodeHubCommand),
      ),
    ),
  );

/**
 * The runtime of an ordinary Worker invocation: it owns no sockets and sends
 * every push and host command to the installation's hubs over Durable Object
 * RPC - the one hub, or every shard when `VITNODE_REALTIME_SHARDS` is above 1.
 * Pushes stay fire-and-forget for the caller - each RPC is handed to
 * `keepAlive` (the request's `waitUntil`) and a failure is logged, never
 * retried: realtime is best effort, the database is the truth.
 *
 * A missing `VITNODE_REALTIME` binding does not fail the invocation: each push
 * logs a {@link RealtimeConfigurationError} with the fix, and `runOnHost`
 * rejects with it.
 */
export const createCloudflareEdgeRuntime = ({
  env,
  keepAlive,
}: {
  env: CloudflareEnv;
  keepAlive: (task: Promise<unknown>) => void;
}): RealtimeRuntime => {
  // Resolved on first use, so a Worker whose binding is missing still serves
  // every request; each push then logs the configuration error.
  let targets: undefined | VitNodeHubTarget[];
  const hubs = (): VitNodeHubTarget[] => (targets ??= vitNodeHubTargets(env));
  const service = createServiceStore();

  const send = (command: RealtimeDeliveryCommand): void => {
    let resolved: VitNodeHubTarget[];
    try {
      resolved = hubs();
    } catch (error) {
      logError(`[VitNode] Realtime ${command.type} was not sent:`, error);

      return;
    }
    dispatchToHubs(resolved, command, keepAlive);
  };

  const runtime: RealtimeRuntime = {
    bind:
      fn =>
      (...args) =>
        runInRealtimeScope({ keepAlive, runtime }, () => fn(...args)),
    crossInstance: () => true,
    kind: "cloudflare-edge",
    onInstanceMessage: noop,
    onRemoteRoomMessage: noop,
    publishToInstances: () => {
      // Only shards tell each other; a Worker invocation has no sockets.
    },
    ready: async () => await Promise.resolve(true),
    realtime: realtimeFromCommands(send),
    registry: null,
    runOnHost: async (name, payload) =>
      await runHostCommandOn(hubs(), name, payload),
    service: (key, create) => service(runtime, key, create),
  };

  return runtime;
};

/** Opens the scope of one Worker invocation. */
export const createCloudflareEdgeScope = ({
  ctx,
  env,
}: {
  ctx?: CloudflareExecutionContext;
  env: CloudflareEnv;
}): RealtimeScope => {
  const keepAlive = (task: Promise<unknown>): void => {
    ctx?.waitUntil(task);
  };

  return {
    env,
    keepAlive,
    resources: new Map<unknown, ScopedResource>(),
    runtime: createCloudflareEdgeRuntime({ env, keepAlive }),
  };
};

/**
 * Runs `fn` as VitNode Worker code: realtime pushes go to the installation's
 * hub and are kept alive with `ctx.waitUntil`, and `scopedDatabase` clients are
 * created for this invocation. HTTP requests get this automatically from the
 * Nitro middleware; call it yourself in a `scheduled` handler, a queue
 * consumer or any other background work that pushes realtime messages.
 * Server-only, Cloudflare Workers only.
 *
 * Without the `VITNODE_REALTIME` binding `fn` still runs; its pushes log a
 * configuration error instead of being delivered.
 *
 * @example
 * ```ts
 * import { runWithVitNodeCloudflare } from "@vitnode/core/cloudflare/edge";
 *
 * export default {
 *   async scheduled(controller, env, ctx) {
 *     await runWithVitNodeCloudflare(env, ctx, async () => {
 *       await runNightlyDigest();
 *     });
 *   },
 * };
 * ```
 */
export const runWithVitNodeCloudflare = <T>(
  env: CloudflareEnv,
  ctx: CloudflareExecutionContext | undefined,
  fn: () => T,
): T => runInRealtimeScope(createCloudflareEdgeScope({ ctx, env }), fn);

/** `GET` with `Upgrade: websocket`. */
export const isWebSocketUpgrade = (request: Request): boolean =>
  request.method === "GET" &&
  request.headers.get("upgrade")?.toLowerCase() === "websocket";

/**
 * Hands a WebSocket upgrade to one of the installation's hubs - a random shard
 * when there are several - which runs the handshake through the API and
 * accepts the socket. The visitor's IP travels in a header the Worker sets
 * itself, never one the client could send. Resolves the hub's answer: `101`
 * with the socket, or the handshake's own rejection. A missing binding answers
 * `503` and logs how to fix it.
 */
export const forwardWebSocketToHub = async (
  request: Request,
  env: CloudflareEnv,
): Promise<Response> => {
  let target: undefined | VitNodeHubTarget;
  try {
    const targets = vitNodeHubTargets(env);
    const [random = 0] = crypto.getRandomValues(new Uint32Array(1));
    target = targets[random % targets.length];
  } catch (error) {
    if (!(error instanceof RealtimeConfigurationError)) throw error;
    logError("[VitNode] WebSocket upgrade refused:", error);

    return new Response("WebSocket is not configured.", { status: 503 });
  }
  if (!target) {
    return new Response("WebSocket is not configured.", { status: 503 });
  }

  const headers = new Headers(request.headers);
  headers.delete(VITNODE_CLIENT_IP_HEADER);
  headers.delete(VITNODE_HUB_NAME_HEADER);
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) headers.set(VITNODE_CLIENT_IP_HEADER, clientIp);
  headers.set(VITNODE_HUB_NAME_HEADER, target.name);

  return await target.stub.fetch(new Request(request.url, { headers }));
};
