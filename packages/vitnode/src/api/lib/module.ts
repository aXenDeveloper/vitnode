import { OpenAPIHono } from "@hono/zod-openapi";

import type { BuildCronReturn } from "./cron";
import type { Route } from "./route";

import { getCurrentPluginId } from "./plugin-context";

export interface BaseBuildModuleReturn<
  M extends string = string,
  Routes extends Route[] = Route[],
> {
  cronJobs: BuildCronReturn[];
  hono: OpenAPIHono;
  modules?: BaseBuildModuleReturn[];
  name: M;
  pluginId: string;
  routes: Routes;
}

export interface BuildModuleReturn<
  M extends string,
  Routes extends Route[] = Route[],
  Modules extends BaseBuildModuleReturn[] = BaseBuildModuleReturn[],
> extends BaseBuildModuleReturn<M, Routes> {
  modules?: Modules;
}

export function buildModule<
  const M extends string,
  const Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
>({
  routes,
  name,
  modules,
  cronJobs = [],
}: {
  cronJobs?: BuildCronReturn[];
  modules?: Modules;
  name: M;
  routes: Routes;
}): BuildModuleReturn<M, Routes, Modules> {
  const pluginId = getCurrentPluginId();

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

  return { routes, pluginId, hono, name, modules, cronJobs };
}
