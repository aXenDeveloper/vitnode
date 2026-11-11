import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import type { NestedRegistration } from "../../../src/api/lib/nested-registrations";
import type { LoadConfiguredPluginIds } from "../plugins/discover";
import type { ModuleImporter } from "../plugins/validate";

import { findNestedRegistrations } from "../../../src/api/lib/nested-registrations";
import { routeStaffPermissions } from "../../../src/api/lib/route-metadata";
import { matchesPlugin } from "../commands/plugin-validate";
import { errorMessage } from "../errors";
import { joinEndpointPath } from "../generate/endpoints";
import { discoverPlugins, isPluginPackage } from "../plugins/discover";
import {
  describeMissingDefinition,
  nativeImport,
  resolveDefinition,
} from "../plugins/validate";
import { findPackageRoot, readPackageJson } from "../project/packages";
import { toDisplayPath } from "../ui/format";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A staff permission a route declares, as read from its metadata. `staffType`
 * and `plugin` are there when the route was given a ref from
 * `defineStaffPermissions`; a plain `{ module, permission }` has neither.
 */
export interface InspectedPermissionRef {
  module: string;
  permission: string;
  plugin?: string;
  staffType?: string;
}

export interface InspectedRoute {
  admin?: InspectedPermissionRef;
  method: string;
  moderator?: InspectedPermissionRef;
  modulePath: string;
  /** Under the plugin's mount, e.g. `/admin/notes/{id}`. */
  path: string;
}

/** Whether a payload schema is declared. Never the payload itself. */
export type PayloadContract = "none" | "schema";

export interface InspectedJob {
  kind: "cron" | "queue";
  module: string;
  name: string;
  /** The plugin whose name the job runs under. */
  owner: string;
  /** Queue tasks only. */
  payload?: PayloadContract;
  schedule?: string;
}

export interface InspectedListener {
  /** Event listeners: the event's name. WebSockets: the socket id. */
  event: string;
  /** Event listeners only: the plugin that defines the event, when known. */
  eventOwner?: string;
  kind: "event" | "websocket";
  module: string;
  /** Event listeners only: the listener's own name, used in logs. */
  name?: string;
  /** Event listeners only. */
  payload?: PayloadContract;
}

export interface InspectedEventDefinition {
  name: string;
  owner: string;
  payload: PayloadContract;
}

/**
 * What a plugin's API definition declares, read from its build output. Reading
 * it calls the plugin's `buildApiPlugin` factory, but never a handler: nothing
 * is scheduled, run or sent.
 */
export interface PluginApiMetadata {
  /** Event definitions the plugin owns (`buildApiPlugin({ eventDefinitions })`). */
  eventDefinitions: InspectedEventDefinition[];
  /** Background work on nested modules, which never runs. */
  ignored: NestedRegistration[];
  jobs: InspectedJob[];
  listeners: InspectedListener[];
  permissionStaff: {
    admin: Record<string, string[]>;
    moderator: Record<string, string[]>;
  };
  routes: InspectedRoute[];
}

export type PluginApiLoad =
  | { id: string; metadata: PluginApiMetadata; root: string; status: "loaded" }
  | {
      id: string;
      reason: string;
      root: null | string;
      status: "error" | "skipped";
    };

interface ModuleLike {
  cronJobs?: unknown[];
  events?: unknown[];
  modules?: ModuleLike[];
  name: string;
  queueTasks?: unknown[];
  routes?: unknown[];
  webSockets?: unknown[];
}

const permissionNames = (entries: unknown): string[] =>
  Array.isArray(entries)
    ? entries.flatMap(entry =>
        typeof entry === "string"
          ? [entry]
          : isRecord(entry) && typeof entry.permission === "string"
            ? [entry.permission]
            : [],
      )
    : [];

const permissionMap = (value: unknown): Record<string, string[]> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).map(([module, entries]) => [
          module,
          permissionNames(entries),
        ]),
      )
    : {};

const optionalString = (value: unknown, key: string): string | undefined =>
  isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;

const stringField = (value: unknown, key: string): string =>
  optionalString(value, key) ?? "?";

const payloadContract = (value: unknown): PayloadContract =>
  isRecord(value) && isRecord(value.payload) ? "schema" : "none";

const permissionRef = (ref: unknown): InspectedPermissionRef | undefined =>
  isRecord(ref)
    ? {
        module: stringField(ref, "module"),
        permission: stringField(ref, "permission"),
        plugin: optionalString(ref, "plugin"),
        staffType: optionalString(ref, "staffType"),
      }
    : undefined;

export const describeApiDefinition = (
  definition: Record<string, unknown>,
): PluginApiMetadata => {
  const pluginId = stringField(definition, "pluginId");
  const modules = (
    Array.isArray(definition.modules) ? definition.modules : []
  ) as ModuleLike[];
  const routes: InspectedRoute[] = [];

  const walk = (module: ModuleLike, prefix: string[]) => {
    const path = [...prefix, module.name];
    for (const route of module.routes ?? []) {
      const config =
        isRecord(route) && isRecord(route.route) ? route.route : {};
      const permissions = routeStaffPermissions(route);
      routes.push({
        admin: permissionRef(permissions?.admin),
        method:
          typeof config.method === "string" ? config.method.toUpperCase() : "?",
        moderator: permissionRef(permissions?.moderator),
        modulePath: path.join("/"),
        path: joinEndpointPath(
          path,
          typeof config.path === "string" ? config.path : "?",
        ),
      });
    }
    for (const child of module.modules ?? []) walk(child, path);
  };
  for (const module of modules) walk(module, []);

  const tagged = (value: unknown) => (Array.isArray(value) ? value : []);
  const staff = isRecord(definition.permissionStaff)
    ? definition.permissionStaff
    : {};

  return {
    eventDefinitions: tagged(definition.eventDefinitions).map(event => ({
      name: stringField(event, "name"),
      owner: optionalString(event, "pluginId") ?? pluginId,
      payload: payloadContract(event),
    })),
    ignored: findNestedRegistrations(modules),
    jobs: [
      ...tagged(definition.cronJobs).map(job => ({
        kind: "cron" as const,
        module: stringField(job, "module"),
        name: stringField(job, "name"),
        owner: pluginId,
        schedule: stringField(job, "schedule"),
      })),
      ...tagged(definition.queueTasks).map(task => ({
        kind: "queue" as const,
        module: stringField(task, "module"),
        name: stringField(task, "name"),
        owner: optionalString(task, "pluginId") ?? pluginId,
        payload: payloadContract(task),
      })),
    ],
    listeners: [
      ...tagged(definition.events).map(listener => {
        const event = isRecord(listener) ? listener.definition : undefined;

        return {
          event:
            optionalString(event, "name") ?? stringField(listener, "event"),
          eventOwner: optionalString(event, "pluginId"),
          kind: "event" as const,
          module: stringField(listener, "module"),
          name: optionalString(listener, "name"),
          payload: payloadContract(event),
        };
      }),
      ...tagged(definition.webSockets).map(socket => ({
        event: stringField(socket, "id"),
        kind: "websocket" as const,
        module: stringField(socket, "module"),
      })),
    ],
    permissionStaff: {
      admin: permissionMap(staff.admin),
      moderator: permissionMap(staff.moderator),
    },
    routes,
  };
};

export const pluginApiFromDefinition = (
  id: string,
  root: string,
  definition: Record<string, unknown>,
): PluginApiLoad => {
  try {
    return {
      id,
      metadata: describeApiDefinition(definition),
      root,
      status: "loaded",
    };
  } catch (error) {
    return { id, reason: errorMessage(error), root, status: "error" };
  }
};

export const loadPluginApi = async (
  id: string,
  root: null | string,
  importModule: ModuleImporter = nativeImport,
): Promise<PluginApiLoad> => {
  if (root === null) {
    return {
      id,
      reason: "configured but not installed",
      root,
      status: "error",
    };
  }

  const file = join(root, "dist", "src", "config.api.js");
  if (!existsSync(file)) {
    return existsSync(join(root, "src", "config.api.ts"))
      ? {
          id,
          reason: `not built: ${toDisplayPath(relative(root, file))} is missing - run vitnode build in the plugin's folder (or pnpm build:plugins).`,
          root,
          status: "error",
        }
      : {
          id,
          reason: "has no API (no src/config.api.ts)",
          root,
          status: "skipped",
        };
  }

  try {
    const resolution = resolveDefinition(await importModule(file));
    if (resolution.status !== "definition") {
      return {
        id,
        reason: describeMissingDefinition(
          resolution,
          toDisplayPath(relative(root, file)),
          "buildApiPlugin()",
        ).join("\n"),
        root,
        status: "error",
      };
    }

    return pluginApiFromDefinition(id, root, resolution.definition);
  } catch (error) {
    return { id, reason: errorMessage(error), root, status: "error" };
  }
};

export const diagnosticTargets = async (
  cwd: string,
  name: string | undefined,
  loadIds?: LoadConfiguredPluginIds,
): Promise<{ configured: boolean; id: string; root: null | string }[]> => {
  const packageRoot = findPackageRoot(cwd);
  if (
    name === undefined &&
    packageRoot !== null &&
    isPluginPackage(packageRoot)
  ) {
    const id = readPackageJson(packageRoot)?.name ?? packageRoot;
    let configured = false;
    try {
      const { plugins } = await discoverPlugins(cwd, { loadIds });
      configured = plugins.some(
        plugin => plugin.id === id && plugin.configured,
      );
    } catch {
      configured = false;
    }

    return [{ configured, id, root: packageRoot }];
  }

  const { plugins } = await discoverPlugins(cwd, { loadIds });
  return plugins
    .filter(plugin => name === undefined || matchesPlugin(plugin, name))
    .map(({ configured, id, root }) => ({ configured, id, root }));
};
