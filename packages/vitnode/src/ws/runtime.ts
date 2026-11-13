import { AsyncLocalStorage } from "node:async_hooks";

import type { WebSocketRegistry } from "./create-registry";
import type { RealtimeDeliveryCommand, VitNodeRealtime } from "./realtime";

import {
  SESSION_REVOKED_CLOSE_CODE,
  SESSION_REVOKED_CLOSE_REASON,
} from "./realtime";

/** A room message that reached this runtime from outside it. */
export type RemoteRoomListener = (
  room: string,
  id: string,
  data: unknown,
) => void;

/** A message another instance published with `publishToInstances`. */
export type InstanceMessageListener = (message: {
  data: unknown;
  origin: string;
  topic: string;
}) => void;

/**
 * Where realtime state lives for the code that is running now:
 *
 * - `process` - a Node/Bun process: it owns its sockets, and Redis (when
 *   configured) relays pushes to every other process.
 * - `cloudflare-hub` - a Cloudflare Durable Object hub: it owns every socket of
 *   one installation.
 * - `cloudflare-edge` - an ordinary Cloudflare Worker invocation (HTTP, cron,
 *   queue): it owns no socket and sends every push to the hub.
 *
 * Core resolves one with {@link currentRealtimeRuntime}; plugins never touch
 * it and keep using `c.get("realtime")` and `wsRegistry`. Server-only.
 */
export interface RealtimeRuntime {
  /**
   * Wraps `fn` so it runs inside this runtime's scope whenever it is called -
   * for timers and listeners that fire outside of the event that created them.
   */
  bind: <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => R;
  /** Whether a push reaches sockets other than the ones in {@link registry}. */
  crossInstance: () => boolean;
  /** A short name for logs and the admin integrations panel. */
  kind: "cloudflare-edge" | "cloudflare-hub" | "process";
  /** Subscribes to {@link publishToInstances} messages from other instances. */
  onInstanceMessage: (listener: InstanceMessageListener) => () => void;
  /**
   * Subscribes to room messages that were sent somewhere else and delivered
   * here: from another Node instance over Redis, or from an HTTP request to
   * the Cloudflare hub. Room owners use it to keep their own state in step.
   */
  onRemoteRoomMessage: (listener: RemoteRoomListener) => () => void;
  /** Sends `data` to every other instance. A no-op where there is none. */
  publishToInstances: (topic: string, data: unknown) => void;
  /**
   * Resolves `true` once a socket accepted here can be reached by every
   * push, `false` when that did not happen within `timeoutMs`.
   */
  ready: (timeoutMs?: number) => Promise<boolean>;
  /** Delivery for `c.get("realtime")` and the `realtime` import. */
  realtime: VitNodeRealtime;
  /** The sockets this runtime owns; `null` where it owns none. */
  registry: null | WebSocketRegistry;
  /**
   * Runs a host command (see {@link registerRealtimeHostCommand}) on the
   * runtime that owns the sockets - here, or in the Cloudflare hub - and
   * resolves its JSON result.
   */
  runOnHost: (name: string, payload: unknown) => Promise<unknown>;
  /**
   * One value per runtime and `key`, created on first use - so state such as
   * the Content Engine live server belongs to the runtime that owns the
   * sockets it tracks, never to the isolate.
   */
  service: <T>(key: string, create: (runtime: RealtimeRuntime) => T) => T;
}

/** What {@link runInRealtimeScope} makes current for the code it runs. */
export interface RealtimeScope {
  /**
   * The Cloudflare Worker bindings of this invocation or hub, such as a
   * Hyperdrive binding. Set by the Cloudflare scopes only.
   */
  env?: Record<string, unknown>;
  /**
   * Keeps work started in this scope alive past the response: a request's
   * `waitUntil`. Every realtime message that leaves the process is passed to
   * it.
   */
  keepAlive?: (task: Promise<unknown>) => void;
  /**
   * Per-scope resources, such as a database client that is only valid for
   * this request or this hub. See `scopedResource`.
   */
  resources?: Map<unknown, ScopedResource>;
  runtime: RealtimeRuntime;
}

/** One per-scope resource and how to release it. */
export interface ScopedResource {
  /** Releases the resource; called when its owner goes idle. */
  dispose?: () => Promise<void> | void;
  instance: unknown;
}

/**
 * Releases and forgets every resource in `resources`, logging - never
 * throwing - a failed release. A hub calls it when it goes idle, so a database
 * connection does not keep it awake.
 */
export const disposeScopedResources = async (
  resources: Map<unknown, ScopedResource>,
): Promise<void> => {
  const entries = [...resources.values()];
  resources.clear();
  await Promise.all(
    entries.map(async ({ dispose }) => {
      try {
        await dispose?.();
      } catch (error) {
        // oxlint-disable-next-line no-console
        console.error("[VitNode] Releasing a scoped resource failed:", error);
      }
    }),
  );
};

const SCOPE_KEY = Symbol.for("vitnode.realtime.scope");
const PLATFORM_KEY = Symbol.for("vitnode.realtime.platform");
const HOST_COMMANDS_KEY = Symbol.for("vitnode.realtime.host-commands");

interface PlatformRequirement {
  /** Shown in the error: how to establish a scope there. */
  hint: string;
  name: string;
}

type Shared = typeof globalThis & {
  [HOST_COMMANDS_KEY]?: Map<string, RealtimeHostCommand>;
  [PLATFORM_KEY]?: PlatformRequirement;
  [SCOPE_KEY]?: AsyncLocalStorage<RealtimeScope>;
};

// On `globalThis`: the app's server bundle and Nitro's bundle each load their
// own copy of this module, and a scope one of them opens must be visible to
// the other.
const shared = globalThis as Shared;
const scopes = (shared[SCOPE_KEY] ??= new AsyncLocalStorage<RealtimeScope>());

/**
 * Runs `fn` with `scope` current, so every realtime call inside it - also
 * ones from modules that have no Hono context - resolves `scope.runtime`.
 * Server-only.
 */
export const runInRealtimeScope = <T>(scope: RealtimeScope, fn: () => T): T =>
  scopes.run(scope, fn);

/** The scope opened by the closest {@link runInRealtimeScope}, if any. */
export const currentRealtimeScope = (): RealtimeScope | undefined =>
  scopes.getStore();

/**
 * Thrown when realtime is used where its runtime cannot be resolved: on a
 * platform that requires an explicit scope (Cloudflare Workers) outside of
 * one, or with its configuration missing. The message says what to fix.
 */
export class RealtimeConfigurationError extends Error {
  override name = "RealtimeConfigurationError";
}

/**
 * Declares that this isolate runs on a platform where process-wide realtime
 * state is wrong - every realtime call must happen inside a scope. Called by
 * the Cloudflare integration when it loads.
 */
export const requireRealtimeScope = (
  requirement: PlatformRequirement,
): void => {
  shared[PLATFORM_KEY] = requirement;
};

/** The platform requirement set with {@link requireRealtimeScope}, if any. */
export const realtimeScopeRequirement = (): PlatformRequirement | undefined =>
  shared[PLATFORM_KEY];

/** Whether this code runs in Cloudflare's workerd runtime. */
export const isWorkerdRuntime = (): boolean =>
  typeof navigator !== "undefined" &&
  (navigator as { userAgent?: string }).userAgent === "Cloudflare-Workers";

let processRuntime: (() => RealtimeRuntime) | undefined;

/** Registers the Node/Bun runtime. Called once by `ws/process-runtime`. */
export const setProcessRealtimeRuntime = (get: () => RealtimeRuntime): void => {
  processRuntime = get;
};

/**
 * The runtime the current code belongs to: the open scope's, else - on Node
 * and Bun - the process runtime.
 *
 * @throws {RealtimeConfigurationError} On Cloudflare Workers outside a scope,
 * where a process-wide fallback would deliver to nobody.
 */
export const currentRealtimeRuntime = (): RealtimeRuntime => {
  const scope = scopes.getStore();
  if (scope) return scope.runtime;

  const requirement = shared[PLATFORM_KEY];
  if (requirement) {
    throw new RealtimeConfigurationError(
      `[VitNode] Realtime was used outside a VitNode execution scope on ${requirement.name}. ${requirement.hint}`,
    );
  }
  if (isWorkerdRuntime()) {
    throw new RealtimeConfigurationError(
      '[VitNode] Realtime is running on Cloudflare Workers without the Cloudflare transport. Set `vitnode({ webSocket: { transport: "cloudflare" } })` in vite.config.ts and declare the hub binding - see "Deploy WebSockets on Cloudflare" in the docs.',
    );
  }
  if (!processRuntime) {
    throw new RealtimeConfigurationError(
      "[VitNode] No realtime runtime is registered in this process.",
    );
  }

  return processRuntime();
};

/** A command a socket host runs for code that does not own the sockets. */
export type RealtimeHostCommand = (
  runtime: RealtimeRuntime,
  payload: unknown,
) => unknown;

const hostCommands = (shared[HOST_COMMANDS_KEY] ??= new Map());

/**
 * Registers a named command that mutates state owned by the socket host -
 * the Content Engine's loaded documents, for example. Code that does not own
 * the sockets runs it with `runtime.runOnHost(name, payload)`: in-process on
 * Node/Bun, in the Durable Object hub on Cloudflare. The handler gets the
 * owning runtime and must validate `payload`, which crossed a boundary. Its
 * result must be JSON. Registering a name again replaces the handler.
 */
export const registerRealtimeHostCommand = (
  name: string,
  handler: RealtimeHostCommand,
): void => {
  hostCommands.set(name, handler);
};

/** Runs a registered host command on `runtime`, which owns the sockets. */
export const runRealtimeHostCommand = async (
  runtime: RealtimeRuntime,
  name: string,
  payload: unknown,
): Promise<unknown> => {
  const handler = hostCommands.get(name);
  if (!handler) {
    throw new RealtimeConfigurationError(
      `[VitNode] Unknown realtime host command "${name}".`,
    );
  }

  return await handler(runtime, payload);
};

/** Whether a host command named `name` is registered in this isolate. */
export const hasRealtimeHostCommand = (name: string): boolean =>
  hostCommands.has(name);

/**
 * Applies one delivery command to the sockets in `registry`. Shared by every
 * runtime that owns sockets, so local, Redis and hub delivery behave the same.
 */
export const deliverToRegistry = (
  registry: WebSocketRegistry,
  command: RealtimeDeliveryCommand,
): void => {
  switch (command.type) {
    case "broadcast": {
      registry.broadcast(command.id, command.data);

      return;
    }
    case "closeUser": {
      registry.closeUser(
        command.userId,
        command.deviceId,
        SESSION_REVOKED_CLOSE_CODE,
        SESSION_REVOKED_CLOSE_REASON,
      );

      return;
    }
    case "sendToUser": {
      registry.sendToUser(command.userId, command.id, command.data);

      return;
    }
    case "sendToUsers": {
      for (const { data, userId } of command.messages) {
        registry.sendToUser(userId, command.id, data);
      }

      return;
    }
    case "toRoom": {
      registry.toRoom(command.room, command.id, command.data);
    }
  }
};

/**
 * A set of listeners with explicit unsubscribe, which reports listener errors
 * instead of letting one listener stop the others.
 */
export const createListenerSet = <A extends unknown[]>(label: string) => {
  const listeners = new Set<(...args: A) => void>();

  return {
    add: (listener: (...args: A) => void): (() => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    clear: () => {
      listeners.clear();
    },
    emit: (...args: A): void => {
      for (const listener of [...listeners]) {
        try {
          listener(...args);
        } catch (error) {
          // oxlint-disable-next-line no-console
          console.error(`${label} listener error:`, error);
        }
      }
    },
    get size() {
      return listeners.size;
    },
  };
};

/** Per-runtime `service` storage, shared by every runtime implementation. */
export const createServiceStore = () => {
  const services = new Map<string, unknown>();

  return <T>(
    runtime: RealtimeRuntime,
    key: string,
    create: (runtime: RealtimeRuntime) => T,
  ): T => {
    if (services.has(key)) return services.get(key) as T;
    const value = create(runtime);
    services.set(key, value);

    return value;
  };
};
