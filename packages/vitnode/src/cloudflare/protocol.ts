import { z } from "zod";

import type { RealtimeDeliveryCommand } from "@/ws/realtime";

import { CONTENT_LIVE_MAX_UPDATE_BYTES } from "@/content/server/live/messages";
import { RealtimeConfigurationError } from "@/ws/runtime";

import type { CloudflareEnv, VitNodeRealtimeHubNamespace } from "./types";

/** The Durable Object binding the realtime hub must be declared under. */
export const VITNODE_REALTIME_BINDING = "VITNODE_REALTIME";

/**
 * The Worker variable that names this installation's hub. Optional: without
 * it every Worker of the script shares the hub named `default`.
 */
export const VITNODE_INSTALLATION_VAR = "VITNODE_INSTALLATION_ID";

/**
 * Carries the visitor's IP from the Worker to the hub. Set by the Worker from
 * `CF-Connecting-IP` after dropping whatever the client sent, and only
 * readable by the hub, which no public request can reach.
 */
export const VITNODE_CLIENT_IP_HEADER = "x-vitnode-hub-client-ip";

/** The most user messages one `sendToUsers` command carries to the hub. */
export const VITNODE_HUB_MAX_BATCH = 500;

/**
 * The largest frame the hub accepts from a browser: room for a Content Engine
 * live update (base64 inside JSON), and nothing like enough to be a weapon.
 */
export const VITNODE_HUB_MAX_FRAME_BYTES = CONTENT_LIVE_MAX_UPDATE_BYTES * 2;

/**
 * The Worker variable that splits an installation's sockets across several
 * hubs (shards), `1` to `32`. Optional, default `1`: one hub. Every push then
 * fans out to each shard, so raise it only when one hub's CPU is the limit.
 */
export const VITNODE_SHARDS_VAR = "VITNODE_REALTIME_SHARDS";

/**
 * The Worker variable that turns hub hibernation off with `"false"`. On by
 * default: an idle hub is evicted from memory while its sockets stay open, and
 * stops accruing duration charges.
 */
export const VITNODE_HIBERNATION_VAR = "VITNODE_REALTIME_HIBERNATION";

/**
 * Tells a hub its own name on upgrade, for runtimes whose Durable Object ids
 * do not expose it. Set by the Worker only.
 */
export const VITNODE_HUB_NAME_HEADER = "x-vitnode-hub-name";

/** The most shards an installation may use. */
export const VITNODE_MAX_SHARDS = 32;

const INSTALLATION_ID = /^[\w.-]{1,64}$/;

const installationOf = (env: CloudflareEnv): string => {
  const value = env[VITNODE_INSTALLATION_VAR];
  if (value === undefined || value === "") return "default";
  if (typeof value !== "string" || !INSTALLATION_ID.test(value)) {
    throw new RealtimeConfigurationError(
      `[VitNode] ${VITNODE_INSTALLATION_VAR} must be 1-64 letters, digits, "_", "." or "-".`,
    );
  }

  return value;
};

/**
 * How many hubs this installation's sockets are spread across:
 * `VITNODE_REALTIME_SHARDS`, or `1`.
 *
 * @throws {RealtimeConfigurationError} When the variable is not a whole number
 * from 1 to 32.
 */
export const vitNodeShardCount = (env: CloudflareEnv): number => {
  const value = env[VITNODE_SHARDS_VAR];
  if (value === undefined || value === "") return 1;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > VITNODE_MAX_SHARDS) {
    throw new RealtimeConfigurationError(
      `[VitNode] ${VITNODE_SHARDS_VAR} must be a whole number from 1 to ${VITNODE_MAX_SHARDS}.`,
    );
  }

  return count;
};

/** Whether hubs hibernate: unless `VITNODE_REALTIME_HIBERNATION` is `"false"`. */
export const isVitNodeHibernationEnabled = (env: CloudflareEnv): boolean => {
  const value = env[VITNODE_HIBERNATION_VAR];

  return !(
    value === false ||
    (typeof value === "string" && value.toLowerCase() === "false")
  );
};

/**
 * The Durable Object names of this installation's hubs: `vitnode:` and the
 * `VITNODE_INSTALLATION_ID` variable (or `default`), plus `:<shard>` when
 * `VITNODE_REALTIME_SHARDS` is above 1. Read from the Worker's own
 * configuration, never from a request, so a client cannot pick another
 * installation's hub. The upgrade route and every dispatch use them.
 *
 * @throws {RealtimeConfigurationError} When either variable is invalid.
 */
export const vitNodeHubNames = (env: CloudflareEnv): string[] => {
  const base = `vitnode:${installationOf(env)}`;
  const count = vitNodeShardCount(env);
  if (count === 1) return [base];

  return Array.from({ length: count }, (_, shard) => `${base}:${shard}`);
};

/** The single-hub name; the first of {@link vitNodeHubNames}. */
export const vitNodeHubName = (env: CloudflareEnv): string =>
  vitNodeHubNames(env)[0] ?? "vitnode:default";

const isNamespace = (value: unknown): value is VitNodeRealtimeHubNamespace =>
  typeof value === "object" &&
  value !== null &&
  typeof Reflect.get(value, "idFromName") === "function" &&
  typeof Reflect.get(value, "get") === "function";

/** A hub's name and RPC stub. */
export interface VitNodeHubTarget {
  name: string;
  stub: ReturnType<VitNodeRealtimeHubNamespace["get"]>;
}

/**
 * The stubs of this installation's hubs, one per shard.
 *
 * @throws {RealtimeConfigurationError} When the `VITNODE_REALTIME` Durable
 * Object binding is missing - realtime then has nowhere to deliver, and
 * pretending otherwise would drop every message.
 */
export const vitNodeHubTargets = (env: CloudflareEnv): VitNodeHubTarget[] => {
  const namespace = env[VITNODE_REALTIME_BINDING];
  if (!isNamespace(namespace)) {
    throw new RealtimeConfigurationError(
      `[VitNode] The "${VITNODE_REALTIME_BINDING}" Durable Object binding is missing. Declare it in wrangler.jsonc with class_name "VitNodeRealtimeHub" and a new_sqlite_classes migration - see "Deploy WebSockets on Cloudflare" in the docs.`,
    );
  }

  return vitNodeHubNames(env).map(name => ({
    name,
    stub: namespace.get(namespace.idFromName(name)),
  }));
};

/**
 * Combines the results of one host command run on every shard: arrays are
 * concatenated, otherwise the first result that is not `null` wins.
 */
export const mergeHostResults = (results: unknown[]): unknown => {
  if (results.length > 0 && results.every(result => Array.isArray(result))) {
    return results.flat();
  }

  return (
    results.find(result => result !== null && result !== undefined) ?? null
  );
};

/** One command from a Worker to its hub. */
export type VitNodeHubCommand =
  | RealtimeDeliveryCommand
  | { data: unknown; origin: string; topic: string; type: "instance" }
  | { name: string; payload: unknown; type: "host" };

const id = z.string().min(1).max(256);
const userId = z.number().int().nonnegative();
const json = z.unknown();

const hubCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ data: json, id, type: z.literal("broadcast") }),
  z.strictObject({
    deviceId: z.number().int().nonnegative().nullable(),
    type: z.literal("closeUser"),
    userId,
  }),
  z.strictObject({
    data: json,
    id,
    type: z.literal("sendToUser"),
    userId,
  }),
  z.strictObject({
    id,
    messages: z
      .array(z.strictObject({ data: json, userId }))
      .max(VITNODE_HUB_MAX_BATCH),
    type: z.literal("sendToUsers"),
  }),
  z.strictObject({
    data: json,
    id,
    room: z.string().min(1).max(512),
    type: z.literal("toRoom"),
  }),
  z.strictObject({
    name: z.string().min(1).max(128),
    payload: json,
    type: z.literal("host"),
  }),
  // A shard telling its peers (`publishToInstances`).
  z.strictObject({
    data: json,
    origin: z.string().min(1).max(256),
    topic: z.string().min(1).max(256),
    type: z.literal("instance"),
  }),
]);

/**
 * Validates a command that crossed the Worker/hub boundary.
 *
 * @throws {z.ZodError} For anything but a known, bounded command.
 */
export const parseVitNodeHubCommand = (input: unknown): VitNodeHubCommand =>
  hubCommandSchema.parse(input);
