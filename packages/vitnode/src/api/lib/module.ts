import { OpenAPIHono } from '@hono/zod-openapi';

import { Route } from './route';

export interface BuildModuleType<T extends Route, Plugin extends string> {
  plugin: Plugin;
  routes: T;
}

export interface BaseBuildModuleReturn<
  P extends string = string,
  M extends string = string,
  Routes extends Route[] = Route[],
> {
  hono: OpenAPIHono;
  modules?: BaseBuildModuleReturn<P>[];
  name: M;
  plugin: P;
  routes: Routes;
}

export interface BuildModuleReturn<
  P extends string,
  M extends string,
  Routes extends Route[] = [],
  Modules extends BaseBuildModuleReturn<P>[] = [],
> extends BaseBuildModuleReturn<P, M, Routes> {
  modules?: Modules;
}

export function buildModule<
  const P extends string,
  const M extends string,
  const Routes extends Route[],
  Modules extends BaseBuildModuleReturn<P>[],
>({
  routes,
  plugin,
  name,
  modules,
}: {
  modules?: Modules;
  name: M;
  plugin: P;
  routes: Routes;
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

  return { routes, plugin, hono, name, modules };
}
