import type { ExecutionContext } from "hono";

import { DurableObject } from "cloudflare:workers";
import { WSContext } from "hono/ws";

import type { InProcessApiHandler } from "@/lib/fetcher/in-process-api.server";
import type { WebSocketRegistry } from "@/ws/create-registry";
import type { VitNodeConnection, VitNodeRawSocket } from "@/ws/handshake";
import type {
  RealtimeRuntime,
  RealtimeScope,
  ScopedResource,
} from "@/ws/runtime";

import { getInProcessApi } from "@/lib/fetcher/in-process-api.server";
import { createWebSocketRegistry } from "@/ws/create-registry";
import {
  connectionIdentityOf,
  createVitNodeConnection,
  runVitNodeHandshake,
} from "@/ws/handshake";
import { sharedCloseListeners } from "@/ws/process-runtime";
import { realtimeFromCommands } from "@/ws/realtime";
import {
  createListenerSet,
  createServiceStore,
  deliverToRegistry,
  disposeScopedResources,
  hasRealtimeHostCommand,
  runInRealtimeScope,
  runRealtimeHostCommand,
} from "@/ws/runtime";
import { WS_PING_ID, WS_PONG_ID } from "@/ws/types";

import type { VitNodeHubCommand, VitNodeHubTarget } from "./protocol";
import type { CloudflareEnv, CloudflareServerWebSocket } from "./types";

import {
  dispatchToHubs,
  isWebSocketUpgrade,
  markCloudflareRealtime,
} from "./edge";
import {
  isVitNodeHibernationEnabled,
  mergeHostResults,
  parseVitNodeHubCommand,
  VITNODE_CLIENT_IP_HEADER,
  VITNODE_HUB_MAX_FRAME_BYTES,
  VITNODE_HUB_NAME_HEADER,
  vitNodeHubTargets,
  vitNodeShardCount,
} from "./protocol";

markCloudflareRealtime();

/** Options of {@link createVitNodeRealtimeHub}. */
export interface VitNodeRealtimeHubOptions {
  /**
   * The embedded API that authenticates handshakes. Defaults to the one the
   * app registered with `configureInProcessApi`.
   */
  api?: () => InProcessApiHandler | undefined;
  /**
   * Loads the app's server bundle when no API has registered in this isolate
   * yet - a hub whose first event is an upgrade, or the first message after a
   * hibernation. Receives a plain `GET` of the WebSocket URL; its response is
   * ignored. With Nitro pass `request => fetchService("ssr", request)` from
   * `nitro/services`; `@vitnode/core/cloudflare/nitro-entry` already does.
   */
  warmup?: (request: Request) => Promise<unknown>;
}

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

const frameBytes = (data: ArrayBuffer | string): number =>
  typeof data === "string" ? data.length * 3 : data.byteLength;

type WebSocketPairConstructor = new () => {
  0: unknown;
  1: CloudflareServerWebSocket;
};

type AutoResponsePairConstructor = new (
  request: string,
  response: string,
) => unknown;

/** The client's heartbeat, answered by the runtime without waking the hub. */
const PING_FRAME = JSON.stringify({ data: null, id: WS_PING_ID });
const PONG_FRAME = JSON.stringify({ data: null, id: WS_PONG_ID });

/**
 * How long a hub waits after its last piece of work before it releases its
 * scoped resources (the database connection), so it can hibernate.
 */
const IDLE_RELEASE_MS = 2000;

/** Headers a replayed handshake needs besides the session cookies. */
const REPLAY_HEADERS = ["origin", "user-agent", "accept-language"];

/** What a hub needs to run a socket's handshake again after hibernating. */
interface ReplayData {
  headers: [string, string][];
  ip?: string;
  url: string;
}

/**
 * Kept with each socket by the runtime (at most 2 KiB), so a hub that wakes
 * from hibernation knows who every socket belongs to without a database read.
 */
interface SocketAttachment {
  deviceId: null | number;
  id: string;
  replay?: ReplayData;
  userId: null | number;
  v: 1;
}

interface SocketRecord {
  attachment: SocketAttachment;
  /**
   * The handlers of the socket's handshake. Missing after a wake until the
   * socket's first message replays the handshake.
   */
  connection?: VitNodeConnection;
  queue: Promise<void>;
  raw: CloudflareServerWebSocket;
  ws: WSContext;
}

const isAttachment = (value: unknown): value is SocketAttachment =>
  typeof value === "object" &&
  value !== null &&
  Reflect.get(value, "v") === 1 &&
  typeof Reflect.get(value, "id") === "string";

interface Sql {
  exec: (
    query: string,
    ...bindings: unknown[]
  ) => { toArray: () => Record<string, unknown>[] };
}

/**
 * Room memberships in the hub's own SQLite storage, so rooms survive
 * hibernation. Keyed by the socket's attachment id; rows of sockets that are
 * gone are dropped on the next wake.
 */
const createRoomStore = (sql: Sql) => {
  sql
    .exec(
      "CREATE TABLE IF NOT EXISTS vitnode_socket_rooms (socket TEXT NOT NULL, room TEXT NOT NULL, member TEXT NOT NULL, PRIMARY KEY (socket, room, member))",
    )
    .toArray();
  sql
    .exec(
      "CREATE TABLE IF NOT EXISTS vitnode_hub_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    )
    .toArray();

  return {
    add: (socket: string, room: string, member: string): void => {
      sql
        .exec(
          "INSERT OR IGNORE INTO vitnode_socket_rooms (socket, room, member) VALUES (?, ?, ?)",
          socket,
          room,
          member,
        )
        .toArray();
    },
    all: (): { member: string; room: string; socket: string }[] =>
      sql
        .exec("SELECT socket, room, member FROM vitnode_socket_rooms")
        .toArray() as { member: string; room: string; socket: string }[],
    getMeta: (key: string): string | undefined =>
      sql
        .exec("SELECT value FROM vitnode_hub_meta WHERE key = ?", key)
        .toArray()[0]?.value as string | undefined,
    remove: (socket: string, room: string, member: string): void => {
      sql
        .exec(
          "DELETE FROM vitnode_socket_rooms WHERE socket = ? AND room = ? AND member = ?",
          socket,
          room,
          member,
        )
        .toArray();
    },
    removeSocket: (socket: string): void => {
      sql
        .exec("DELETE FROM vitnode_socket_rooms WHERE socket = ?", socket)
        .toArray();
    },
    setMeta: (key: string, value: string): void => {
      sql
        .exec(
          "INSERT OR REPLACE INTO vitnode_hub_meta (key, value) VALUES (?, ?)",
          key,
          value,
        )
        .toArray();
    },
  };
};

type RoomStore = ReturnType<typeof createRoomStore>;

/** The public RPC methods of a hub, for typing a stub in app code. */
export interface VitNodeRealtimeHubRpc {
  /**
   * Applies one validated command from a Worker of this installation or a
   * peer shard: delivery to the hub's sockets, a host command, or a peer's
   * instance message. Resolves the host command's JSON result, `null`
   * otherwise.
   */
  dispatch: (command: unknown) => Promise<unknown>;
}

/**
 * Creates the Durable Object class that owns the WebSockets of one VitNode
 * installation on Cloudflare Workers - the realtime hub, or one shard of it.
 * Export the class from the Worker entry under the name the `VITNODE_REALTIME`
 * binding's `class_name` gives; `@vitnode/core/cloudflare/nitro-entry` exports
 * it as `VitNodeRealtimeHub` for a Nitro app. Cloudflare Workers only.
 *
 * Each hub instance owns its own socket registry, rooms, Content Engine live
 * server, listeners and database clients (`scopedDatabase`), so two hubs in
 * one isolate never share state. It:
 *
 * - accepts `/api/ws` upgrades the Worker forwards: the handshake runs through
 *   the API's real middleware (Origin check, rate limiter, session cookie),
 *   a rejected one is answered with its own status before any socket exists,
 *   and an accepted one gets a `WebSocketPair`, its `Set-Cookie` headers and
 *   one `WSContext`;
 * - runs every socket event in a fresh scope of its own, so `c.get("realtime")`,
 *   `wsRegistry` and the database resolve to this hub;
 * - applies `dispatch` commands from HTTP requests, cron, queues and peer
 *   shards, delivered locally and never sent anywhere again.
 *
 * **Hibernation** (default; `VITNODE_REALTIME_HIBERNATION=false` turns it off):
 * sockets are accepted with the Hibernation API, so an idle hub is evicted
 * from memory while its sockets stay open, and stops accruing duration. The
 * runtime answers the client's heartbeat itself. Each socket's user and device
 * travel in its attachment and its rooms in the hub's SQLite storage, so
 * pushes and rooms work right after a wake. A socket's handlers are rebuilt on
 * its first message after a wake by replaying its handshake - with its
 * session, device and admin cookies only - and a socket whose session changed
 * meanwhile is closed with `1008` so the client reconnects as whoever it is
 * now. In-memory state a handler keeps per socket does not survive a wake;
 * Content Engine live editing and live refresh keep the hub awake while they
 * have members. Needs a SQLite-backed class (`new_sqlite_classes`); without it
 * the hub does not hibernate.
 *
 * **Sharding** (`VITNODE_REALTIME_SHARDS`): every shard relays the pushes,
 * instance messages and host commands of its own handlers to its peers, the
 * way Node instances share them over Redis.
 *
 * Sockets and presence live in memory and in the socket attachments only:
 * a deploy closes every socket, and clients reconnect with backoff, rejoin
 * their rooms and reload durable state from the database.
 */
export const createVitNodeRealtimeHub = ({
  api = getInProcessApi,
  warmup,
}: VitNodeRealtimeHubOptions = {}): VitNodeRealtimeHubClass =>
  class VitNodeRealtimeHub
    extends DurableObject<CloudflareEnv>
    implements VitNodeRealtimeHubRpc
  {
    constructor(ctx: unknown, env: CloudflareEnv) {
      super(ctx, env);

      const sql = this.ctx.storage.sql;
      this.#store = sql ? createRoomStore(sql) : null;
      this.#hibernate =
        isVitNodeHibernationEnabled(env) && this.#store !== null;
      if (isVitNodeHibernationEnabled(env) && !this.#store) {
        logError(
          "[VitNode] The realtime hub cannot hibernate:",
          new Error(
            'Its class has no SQLite storage. Declare it under "new_sqlite_classes" in the Wrangler migrations.',
          ),
        );
      }
      this.#name = this.ctx.id.name ?? this.#store?.getMeta("name");

      const base = createWebSocketRegistry({ sharedCloseListeners });
      this.#registry = this.#persisted(base);
      this.#runtime = this.#createRuntime();

      if (this.#hibernate) {
        const Pair = (
          globalThis as typeof globalThis & {
            WebSocketRequestResponsePair?: AutoResponsePairConstructor;
          }
        ).WebSocketRequestResponsePair;
        if (Pair) {
          this.ctx.setWebSocketAutoResponse(new Pair(PING_FRAME, PONG_FRAME));
        }
        this.#restore(base);
      }
    }
    #activity = 0;
    readonly #hibernate: boolean;
    readonly #idByWs = new WeakMap<WSContext, string>();
    #idleTimer: ReturnType<typeof setTimeout> | undefined;
    readonly #instanceListeners = createListenerSet<
      [{ data: unknown; origin: string; topic: string }]
    >("Realtime hub instance message");
    readonly #keepAlive = (task: Promise<unknown>): void => {
      this.#begin();
      const settled = task.then(
        () => {
          this.#end();
        },
        () => {
          this.#end();
        },
      );
      this.ctx.waitUntil(settled);
    };
    #name: string | undefined;
    readonly #records = new Map<CloudflareServerWebSocket, SocketRecord>();
    readonly #registry: WebSocketRegistry;
    readonly #resources = new Map<unknown, ScopedResource>();
    readonly #roomListeners =
      createListenerSet<[room: string, id: string, data: unknown]>(
        "Realtime hub room",
      );
    readonly #runtime: RealtimeRuntime;
    readonly #services = createServiceStore();
    readonly #store: null | RoomStore;

    #warming: Promise<unknown> | undefined;

    /** Creates the record and `WSContext` of one socket. */
    #adopt(
      raw: CloudflareServerWebSocket,
      attachment: SocketAttachment,
    ): SocketRecord {
      const url = attachment.replay?.url ?? "";
      const socket = this.#rawSocket({ raw }, url);
      const ws = new WSContext({
        close: socket.close,
        protocol: socket.protocol,
        raw,
        get readyState() {
          return raw.readyState as 0 | 1 | 2 | 3;
        },
        send: socket.send,
        url,
      });
      this.#idByWs.set(ws, attachment.id);
      const record: SocketRecord = {
        attachment,
        queue: Promise.resolve(),
        raw,
        ws,
      };
      this.#records.set(raw, record);

      return record;
    }

    async #api(url: string): Promise<InProcessApiHandler | undefined> {
      const current = api();
      if (current || !warmup) return current;

      this.#warming ??= warmup(new Request(url))
        .catch((error: unknown) => {
          logError("[VitNode] Realtime hub warmup error:", error);
        })
        .finally(() => {
          this.#warming = undefined;
        });
      await this.#warming;

      return api();
    }

    /** Work starts: the hub is busy and keeps its resources. */
    #begin(): void {
      this.#activity++;
      clearTimeout(this.#idleTimer);
      this.#idleTimer = undefined;
    }

    /** Runs one event's work as busy time. */
    async #busy<T>(work: () => Promise<T>): Promise<T> {
      this.#begin();
      try {
        return await work();
      } finally {
        this.#end();
      }
    }

    #close(record: SocketRecord, code: number, reason: string): void {
      try {
        record.raw.close(code, reason);
      } catch {
        // Already closed.
      }
    }

    #createRuntime(): RealtimeRuntime {
      const runtime: RealtimeRuntime = {
        bind:
          fn =>
          (...args) => {
            // Timer callbacks (the live sweeper, document saves) are busy time
            // too, so the database stays open while they run.
            this.#begin();
            let result: ReturnType<typeof fn>;
            try {
              result = this.#run(() => fn(...args));
            } catch (error) {
              this.#end();
              throw error;
            }
            if (result instanceof Promise) {
              result.then(
                () => {
                  this.#end();
                },
                () => {
                  this.#end();
                },
              );
            } else {
              this.#end();
            }

            return result;
          },
        crossInstance: () => this.#peers().length > 0,
        kind: "cloudflare-hub",
        onInstanceMessage: listener => this.#instanceListeners.add(listener),
        onRemoteRoomMessage: listener => this.#roomListeners.add(listener),
        publishToInstances: (topic, data) => {
          const peers = this.#peers();
          if (peers.length === 0) return;
          dispatchToHubs(
            peers,
            { data, origin: this.#name ?? "", topic, type: "instance" },
            this.#keepAlive,
          );
        },
        ready: async () => await Promise.resolve(true),
        realtime: realtimeFromCommands(command => {
          deliverToRegistry(this.#registry, command);
          const peers = this.#peers();
          if (peers.length > 0) {
            dispatchToHubs(peers, command, this.#keepAlive);
          }
        }),
        registry: this.#registry,
        runOnHost: async (name, payload) => {
          const local = await runRealtimeHostCommand(runtime, name, payload);
          const peers = this.#peers();
          if (peers.length === 0) return local;

          return mergeHostResults([
            local,
            ...(await Promise.all(
              peers.map(
                async ({ stub }) =>
                  await stub.dispatch({
                    name,
                    payload,
                    type: "host",
                  } satisfies VitNodeHubCommand),
              ),
            )),
          ]);
        },
        service: (key, create) => this.#services(runtime, key, create),
      };

      return runtime;
    }

    /**
     * Work ends. Once nothing is left, the scoped resources are released
     * shortly after - an open database connection keeps a Durable Object from
     * hibernating - and created again by the next event that needs them.
     */
    #end(): void {
      this.#activity = Math.max(0, this.#activity - 1);
      if (this.#activity > 0 || this.#idleTimer) return;
      this.#idleTimer = setTimeout(() => {
        this.#idleTimer = undefined;
        if (this.#activity === 0) {
          void disposeScopedResources(this.#resources);
        }
      }, IDLE_RELEASE_MS);
    }

    #onClose(
      raw: CloudflareServerWebSocket,
      code: number,
      reason: string,
    ): void {
      const record = this.#records.get(raw);
      if (!record) return;
      this.#records.delete(raw);
      this.#run(() => {
        record.connection?.close({ code, reason });
        // Also for a socket whose handlers never came back after a wake.
        this.#registry.remove(record.ws);
      });
      try {
        raw.close();
      } catch {
        // Already closed.
      }
    }

    #onError(raw: CloudflareServerWebSocket, error: unknown): void {
      const record = this.#records.get(raw);
      if (!record) return;
      this.#records.delete(raw);
      this.#run(() => {
        if (record.connection) record.connection.error(error);
        else logError("WebSocket error:", error);
        this.#registry.remove(record.ws);
      });
    }

    async #onMessage(
      raw: CloudflareServerWebSocket,
      data: ArrayBuffer | string,
    ): Promise<void> {
      const record = this.#records.get(raw);
      if (!record) return;
      if (frameBytes(data) > VITNODE_HUB_MAX_FRAME_BYTES) {
        this.#close(record, 1009, "Message too big");

        return;
      }

      // One message at a time per socket, so a replayed handshake finishes
      // before the messages that arrived while it ran.
      record.queue = record.queue
        .then(async () => {
          await this.#run(async () => {
            const connection = await this.#resume(record);
            connection?.message(data);
          });
        })
        .catch((error: unknown) => {
          logError("[VitNode] Realtime hub message error:", error);
        });
      await record.queue;
    }

    /** Other shards of this installation, or none. */
    #peers(): VitNodeHubTarget[] {
      let count = 1;
      try {
        count = vitNodeShardCount(this.env);
      } catch (error) {
        logError("[VitNode] Realtime hub shard configuration:", error);
      }
      if (count === 1) return [];
      if (!this.#name) {
        logError(
          "[VitNode] Realtime hub cannot reach its peer shards:",
          new Error("It does not know its own name yet."),
        );

        return [];
      }
      const name = this.#name;

      return vitNodeHubTargets(this.env).filter(target => target.name !== name);
    }

    /** Wraps a registry so room changes are written to storage. */
    #persisted(base: WebSocketRegistry): WebSocketRegistry {
      const store = this.#store;
      if (!store) return base;
      const idOf = (ws: WSContext) => this.#idByWs.get(ws);

      return {
        ...base,
        join: (ws, room, member) => {
          const joined = base.join(ws, room, member);
          const id = idOf(ws);
          if (joined && id) store.add(id, room, member);

          return joined;
        },
        leave: (ws, room, member) => {
          const left = base.leave(ws, room, member);
          const id = idOf(ws);
          if (left && id) store.remove(id, room, member);

          return left;
        },
        remove: ws => {
          base.remove(ws);
          const id = idOf(ws);
          if (id) store.removeSocket(id);
        },
      };
    }

    #rawSocket(
      record: Pick<SocketRecord, "raw">,
      url: string,
    ): VitNodeRawSocket {
      const { raw } = record;

      return {
        close: (code, reason) => {
          raw.close(code, reason);
        },
        protocol: raw.protocol ?? undefined,
        get readyState() {
          return raw.readyState;
        },
        send: data => {
          raw.send(data);
        },
        url,
      };
    }

    /**
     * After a wake: every socket the runtime kept open goes back into the
     * registry with its user, device and rooms. Handlers come back lazily, on
     * the socket's next message.
     */
    #restore(base: WebSocketRegistry): void {
      const sockets = this.ctx.getWebSockets() as CloudflareServerWebSocket[];
      const rooms = new Map<string, { member: string; room: string }[]>();
      for (const row of this.#store?.all() ?? []) {
        rooms.set(row.socket, [...(rooms.get(row.socket) ?? []), row]);
      }

      const alive = new Set<string>();
      for (const raw of sockets) {
        let attachment: unknown;
        try {
          attachment = raw.deserializeAttachment();
        } catch {
          attachment = undefined;
        }
        if (!isAttachment(attachment)) {
          try {
            raw.close(1011, "Unknown socket");
          } catch {
            // Already gone.
          }
          continue;
        }
        const record = this.#adopt(raw, attachment);
        alive.add(attachment.id);
        base.add(record.ws, attachment.userId, attachment.deviceId);
        for (const { member, room } of rooms.get(attachment.id) ?? []) {
          base.join(record.ws, room, member);
        }
      }

      for (const socket of rooms.keys()) {
        if (!alive.has(socket)) this.#store?.removeSocket(socket);
      }
    }

    /**
     * Rebuilds a socket's handlers after a wake by running its handshake again
     * through the API, with the cookies and headers kept in its attachment. A
     * socket whose session changed meanwhile is closed so the client
     * reconnects with the session it has now.
     */
    async #resume(
      record: SocketRecord,
    ): Promise<undefined | VitNodeConnection> {
      if (record.connection) return record.connection;
      const { deviceId, replay, userId } = record.attachment;
      if (!replay) {
        this.#close(record, 1012, "Reconnect");

        return undefined;
      }

      const handler = await this.#api(replay.url);
      if (!handler) {
        this.#close(record, 1013, "Try again later");

        return undefined;
      }

      const accepted = await runVitNodeHandshake(
        handler,
        new Request(replay.url, { headers: replay.headers }),
        { clientAddress: replay.ip, executionCtx: this.#executionCtx },
      );
      if (accepted instanceof Response) {
        await accepted.body?.cancel();
        this.#close(
          record,
          accepted.status === 401 || accepted.status === 403 ? 1008 : 1013,
          "Reconnect",
        );

        return undefined;
      }

      const identity = connectionIdentityOf(accepted.events);
      if (
        identity &&
        (identity.userId !== userId || identity.deviceId !== deviceId)
      ) {
        this.#close(record, 1008, "Session changed");

        return undefined;
      }
      if (record.connection) return record.connection;

      const connection = createVitNodeConnection(accepted.events);
      connection.resume(record.ws, this.#rawSocket(record, replay.url));
      record.connection = connection;

      return connection;
    }

    #run<T>(fn: () => T): T {
      return runInRealtimeScope(this.#scope(), fn);
    }

    async #runCommand(command: VitNodeHubCommand): Promise<unknown> {
      return await this.#run(async () => {
        if (command.type === "instance") {
          const { data, origin, topic } = command;
          this.#instanceListeners.emit({ data, origin, topic });

          return null;
        }
        if (command.type !== "host") {
          deliverToRegistry(this.#registry, command);
          // An HTTP request's room push is, to the hub, what a remote
          // instance's is on Node: room owners keep their state in step.
          if (command.type === "toRoom") {
            this.#roomListeners.emit(command.room, command.id, command.data);
          }

          return null;
        }

        // A hub whose isolate has not loaded the app owns no sockets and no
        // loaded documents, so there is nothing for the command to change.
        if (
          !hasRealtimeHostCommand(command.name) &&
          this.#registry.connectionCount() === 0
        ) {
          return null;
        }

        return await runRealtimeHostCommand(
          this.#runtime,
          command.name,
          command.payload,
        );
      });
    }

    /** A fresh scope for one event, bound to this hub's state. */
    #scope(): RealtimeScope {
      return {
        keepAlive: this.#keepAlive,
        resources: this.#resources,
        runtime: this.#runtime,
      };
    }

    async #upgrade(request: Request): Promise<Response> {
      if (!isWebSocketUpgrade(request)) {
        return new Response("WebSocket upgrade is required.", { status: 426 });
      }

      const announced = request.headers.get(VITNODE_HUB_NAME_HEADER);
      if (!this.#name && announced) {
        this.#name = announced;
        this.#store?.setMeta("name", announced);
      }

      const handler = await this.#api(request.url);
      if (!handler) {
        return new Response("The VitNode API is not available.", {
          status: 503,
        });
      }

      const clientAddress =
        request.headers.get(VITNODE_CLIENT_IP_HEADER) ?? undefined;
      const headers = new Headers(request.headers);
      headers.delete(VITNODE_CLIENT_IP_HEADER);
      headers.delete(VITNODE_HUB_NAME_HEADER);

      const accepted = await runVitNodeHandshake(
        handler,
        new Request(request.url, { headers }),
        { clientAddress, executionCtx: this.#executionCtx },
      );
      if (accepted instanceof Response) return accepted;

      const Pair = (
        globalThis as typeof globalThis & {
          WebSocketPair?: WebSocketPairConstructor;
        }
      ).WebSocketPair;
      if (!Pair) {
        return new Response("WebSocketPair is not available.", {
          status: 500,
        });
      }
      const pair = new Pair();
      const client = pair[0];
      const server = pair[1];

      const identity = connectionIdentityOf(accepted.events);
      const attachment: SocketAttachment = {
        deviceId: identity?.deviceId ?? null,
        id: crypto.randomUUID(),
        replay: replayDataOf(request.url, headers, accepted.cookieNames, {
          ip: clientAddress,
        }),
        userId: identity?.userId ?? null,
        v: 1,
      };

      if (this.#hibernate) {
        this.ctx.acceptWebSocket(server);
        try {
          server.serializeAttachment(attachment);
        } catch {
          // Over 2 KiB: after a wake this socket is asked to reconnect.
          attachment.replay = undefined;
          server.serializeAttachment(attachment);
        }
      } else {
        server.accept();
        server.addEventListener("message", event => {
          this.#keepAlive(this.#onMessage(server, event.data));
        });
        server.addEventListener("close", event => {
          this.#onClose(server, event.code, event.reason);
        });
        server.addEventListener("error", event => {
          this.#onError(server, event.error ?? new Error("WebSocket error"));
        });
      }

      const record = this.#adopt(server, attachment);
      const connection = createVitNodeConnection(accepted.events);
      record.connection = connection;
      connection.open(this.#rawSocket(record, request.url), server, record.ws);

      const responseHeaders = new Headers();
      for (const cookie of accepted.setCookies) {
        responseHeaders.append("set-cookie", cookie);
      }

      return new Response(null, {
        headers: responseHeaders,
        status: 101,
        webSocket: client,
      } as ResponseInit);
    }

    async dispatch(input: unknown): Promise<unknown> {
      const command = parseVitNodeHubCommand(input);

      return await this.#busy(async () => await this.#runCommand(command));
    }

    async fetch(request: Request): Promise<Response> {
      return await this.#busy(
        async () => await this.#run(async () => await this.#upgrade(request)),
      );
    }

    /** Hibernation API: a socket closed. */
    webSocketClose(
      raw: CloudflareServerWebSocket,
      code: number,
      reason: string,
    ): void {
      this.#begin();
      try {
        this.#onClose(raw, code, reason);
      } finally {
        this.#end();
      }
    }

    /** Hibernation API: a socket failed. */
    webSocketError(raw: CloudflareServerWebSocket, error: unknown): void {
      this.#begin();
      try {
        this.#onError(raw, error);
      } finally {
        this.#end();
      }
    }

    /** Hibernation API: a frame from a socket. */
    async webSocketMessage(
      raw: CloudflareServerWebSocket,
      data: ArrayBuffer | string,
    ): Promise<void> {
      await this.#busy(async () => {
        await this.#onMessage(raw, data);
      });
    }

    get #executionCtx(): ExecutionContext {
      return {
        passThroughOnException: () => undefined,
        props: {},
        waitUntil: this.#keepAlive,
      };
    }
  };

/**
 * The parts of a handshake to keep for a replay: the URL, the cookies the API
 * authenticates with (never the others), a few request headers, the IP.
 */
const replayDataOf = (
  url: string,
  headers: Headers,
  cookieNames: string[],
  { ip }: { ip?: string },
): ReplayData => {
  const keep = new Set(cookieNames);
  const cookie = (headers.get("cookie") ?? "")
    .split(";")
    .map(part => part.trim())
    .filter(part => keep.has(part.slice(0, part.indexOf("="))))
    .join("; ");
  const kept: [string, string][] = REPLAY_HEADERS.flatMap(name => {
    const value = headers.get(name);

    return value ? [[name, value] as [string, string]] : [];
  });
  if (cookie) kept.push(["cookie", cookie]);

  return { headers: kept, ip, url };
};

/** An instance of the realtime hub, as the Workers runtime drives it. */
export interface VitNodeRealtimeHub extends VitNodeRealtimeHubRpc {
  /** Accepts a WebSocket upgrade forwarded by this installation's Worker. */
  fetch: (request: Request) => Promise<Response>;
  /** Hibernation API handlers, called by the Workers runtime. */
  webSocketClose: (
    ws: CloudflareServerWebSocket,
    code: number,
    reason: string,
  ) => void;
  webSocketError: (ws: CloudflareServerWebSocket, error: unknown) => void;
  webSocketMessage: (
    ws: CloudflareServerWebSocket,
    data: ArrayBuffer | string,
  ) => Promise<void>;
}

/** The class {@link createVitNodeRealtimeHub} returns. */
export type VitNodeRealtimeHubClass = new (
  ctx: unknown,
  env: CloudflareEnv,
) => VitNodeRealtimeHub;
