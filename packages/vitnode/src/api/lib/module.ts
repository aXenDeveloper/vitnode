import { OpenAPIHono } from "@hono/zod-openapi";

import type { AnyContentContainerDefinition } from "@/content/containers/types";
import type { AnyContentModel } from "@/content/server/model";
import type { AnyContentTypeDefinition } from "@/content/types";

import type { SearchIndexer } from "../models/search";
import type { BuildCronReturn } from "./cron";
import type { BuildEventListenerReturn } from "./events";
import type { AnyNotificationTypeDefinition } from "./notifications/registry";
import type { BuildQueueTaskReturn } from "./queue";
import type { Route } from "./route";
import type { BuildWebSocketReturn } from "./websocket";

export interface BuildModuleType<T extends Route, Plugin extends string> {
  plugin: Plugin;
  routes: T;
}

/** A built module, as a parent module or `buildApiPlugin` receives it. */
export interface BaseBuildModuleReturn<
  P extends string = string,
  M extends string = string,
  Routes extends Route<P>[] = Route<P>[],
> {
  contentContainers?: AnyContentContainerDefinition[];
  contentModels?: AnyContentModel[];

  contentTypes?: AnyContentTypeDefinition[];
  cronJobs: BuildCronReturn[];
  events: BuildEventListenerReturn[];
  hono: OpenAPIHono;
  modules?: BaseBuildModuleReturn<P>[];
  name: M;
  notificationTypes?: AnyNotificationTypeDefinition[];
  pluginId: P;
  publicContentTypes?: AnyContentTypeDefinition[];
  queueTasks: BuildQueueTaskReturn[];
  routes: Routes;
  searchIndexers?: SearchIndexer[];
  webSockets: BuildWebSocketReturn[];
}

export interface BuildModuleReturn<
  P extends string,
  M extends string,
  Routes extends Route<P>[] = Route<P>[],
  Modules extends BaseBuildModuleReturn<P>[] = BaseBuildModuleReturn<P>[],
> extends BaseBuildModuleReturn<P, M, Routes> {
  modules?: Modules;
}

/** What `buildModule` accepts. */
export interface BuildModuleOptions<
  P extends string,
  M extends string,
  Routes extends Route<P>[],
  Modules extends BaseBuildModuleReturn<P>[],
> {
  /** Content containers this module registers. Collected from any depth. */
  contentContainers?: AnyContentContainerDefinition[];
  /** Content models this module registers. Collected from any depth. */
  contentModels?: AnyContentModel[];
  /** Content types this module registers. Collected from any depth. */
  contentTypes?: AnyContentTypeDefinition[];
  /** Scheduled jobs. Only read from a plugin's top-level modules. */
  cronJobs?: BuildCronReturn[];
  /** Event listeners. Only read from a plugin's top-level modules. */
  events?: BuildEventListenerReturn[];
  /** Child modules, each mounted at `/{child.name}` below this one. */
  modules?: Modules;
  /**
   * The path segment the module is mounted at, and its part of the fetcher's
   * `module` path (`admin/ai` for an `ai` module inside `admin`).
   */
  name: M;
  /** Notification types this module registers. Collected from any depth. */
  notificationTypes?: AnyNotificationTypeDefinition[];
  /** Content types this module serves public URLs for. Collected from any depth. */
  publicContentTypes?: AnyContentTypeDefinition[];
  /** Background queue tasks. Only read from a plugin's top-level modules. */
  queueTasks?: BuildQueueTaskReturn[];
  /** Routes built with the plugin's bound `buildRoute`. Pass `[]` for a module with only children. */
  routes: Routes;
  /** Search indexers this module registers. Collected from any depth. */
  searchIndexers?: SearchIndexer[];
  /** WebSocket endpoints. Only read from a plugin's top-level modules. */
  webSockets?: BuildWebSocketReturn[];
}

/**
 * Groups routes, child modules and what they register into one Hono
 * sub-application. Plugins call the bound version from `bindApiPlugin`, which
 * supplies `pluginId`.
 *
 * Mind the depth: content types, models, containers, notification types and
 * search indexers are collected from the whole module tree, but cron jobs,
 * events, queue tasks and WebSockets only from the modules passed to
 * `buildApiPlugin` directly - declared on a nested module, they never run.
 *
 * @example
 * ```ts
 * import { buildModule } from "@/api/builders";
 *
 * export const postsModule = buildModule({
 *   name: "posts",
 *   routes: [listPostsRoute, showPostRoute],
 * });
 * ```
 */
export function buildModule<
  const P extends string,
  const M extends string,
  const Routes extends Route<P>[],
  Modules extends BaseBuildModuleReturn<P>[],
>({
  routes,
  pluginId,
  name,
  modules,
  contentContainers,
  contentModels,
  contentTypes,
  notificationTypes,
  publicContentTypes,
  cronJobs = [],
  events = [],
  queueTasks = [],
  searchIndexers,
  webSockets = [],
}: BuildModuleOptions<P, M, Routes, Modules> & {
  pluginId: P;
}): BuildModuleReturn<NoInfer<P>, M, Routes, Modules> {
  const hono = new OpenAPIHono();

  if (routes) {
    routes.forEach(({ handler, hook, route }) => {
      hono.openapi(route, handler, hook as never);
    });
  }

  if (modules) {
    modules.forEach(module => {
      hono.route(`/${module.name}`, module.hono);
    });
  }

  return {
    routes,
    pluginId,
    hono,
    name,
    modules,
    contentContainers,
    contentModels,
    contentTypes,
    cronJobs,
    events,
    notificationTypes,
    publicContentTypes,
    queueTasks,
    searchIndexers,
    webSockets,
  };
}
