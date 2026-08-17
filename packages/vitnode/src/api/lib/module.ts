import { OpenAPIHono } from "@hono/zod-openapi";

import type { AnyContentModel } from "@/content/server/model";
import type { AnyContentTypeDefinition } from "@/content/types";

import type { SearchIndexer } from "../models/search";
import type { BuildCronReturn } from "./cron";
import type { BuildEventListenerReturn } from "./events";
import type { BuildQueueTaskReturn } from "./queue";
import type { Route } from "./route";
import type { BuildWebSocketReturn } from "./websocket";

export interface BuildModuleType<T extends Route, Plugin extends string> {
  plugin: Plugin;
  routes: T;
}

export interface BaseBuildModuleReturn<
  P extends string = string,
  M extends string = string,
  Routes extends Route<P>[] = Route<P>[],
> {
  /**
   * The models behind those content types - table, columns, schemas and
   * services, not just the definition.
   *
   * Collected recursively like `contentTypes`, and exposed on the request
   * context so background work can find the model for a content type id. The
   * scheduled-publication queue task is the reason it exists: it runs in a cron
   * request that has no idea which plugin owns the record it is publishing.
   */
  contentModels?: AnyContentModel[];
  /**
   * Content types whose CRUD routes this module serves. Unlike `events` and
   * `cronJobs`, these are collected recursively by `buildApiPlugin`, so a
   * generated content module can sit wherever it reads best in the tree -
   * usually nested inside the plugin's own `admin` module.
   */
  contentTypes?: AnyContentTypeDefinition[];
  cronJobs: BuildCronReturn[];
  events: BuildEventListenerReturn[];
  hono: OpenAPIHono;
  modules?: BaseBuildModuleReturn<P>[];
  name: M;
  pluginId: P;
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
  contentModels,
  contentTypes,
  cronJobs = [],
  events = [],
  queueTasks = [],
  searchIndexers,
  webSockets = [],
}: {
  contentModels?: AnyContentModel[];
  contentTypes?: AnyContentTypeDefinition[];
  cronJobs?: BuildCronReturn[];
  events?: BuildEventListenerReturn[];
  modules?: Modules;
  name: M;
  pluginId: P;
  queueTasks?: BuildQueueTaskReturn[];
  routes: Routes;
  searchIndexers?: SearchIndexer[];
  webSockets?: BuildWebSocketReturn[];
}): BuildModuleReturn<P, M, Routes, Modules> {
  const hono = new OpenAPIHono();

  if (routes) {
    routes.forEach(({ handler, route }) => {
      hono.openapi(route, handler);
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
    contentModels,
    contentTypes,
    cronJobs,
    events,
    queueTasks,
    searchIndexers,
    webSockets,
  };
}
