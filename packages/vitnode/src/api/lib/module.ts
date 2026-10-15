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

export interface BuildModuleOptions<
  P extends string,
  M extends string,
  Routes extends Route<P>[],
  Modules extends BaseBuildModuleReturn<P>[],
> {
  contentContainers?: AnyContentContainerDefinition[];
  contentModels?: AnyContentModel[];
  contentTypes?: AnyContentTypeDefinition[];
  cronJobs?: BuildCronReturn[];
  events?: BuildEventListenerReturn[];
  modules?: Modules;
  name: M;
  notificationTypes?: AnyNotificationTypeDefinition[];
  publicContentTypes?: AnyContentTypeDefinition[];
  queueTasks?: BuildQueueTaskReturn[];
  routes: Routes;
  searchIndexers?: SearchIndexer[];
  webSockets?: BuildWebSocketReturn[];
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
