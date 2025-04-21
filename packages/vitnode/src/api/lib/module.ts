import { OpenAPIHono } from '@hono/zod-openapi';

import { Route } from './route';

export interface BuildModuleType<T extends Route, Plugin extends string> {
  plugin: Plugin;
  routes: T;
}

export interface BuildModuleReturn<
  P extends string = string,
  M extends string = string,
  Routes extends Route = Route,
> {
  hono: OpenAPIHono;
  name: M;
  plugin: P;
  routes?: Routes;
}

export function buildModule<
  const P extends string,
  const M extends string,
  const Routes extends Route,
>({
  routes,
  plugin,
  name,
}: {
  name: M;
  plugin: P;
  routes?: Routes;
}): BuildModuleReturn<P, M, Routes> {
  const hono = new OpenAPIHono();

  if (routes) {
    routes.forEach(({ handler, route }) => {
      hono.openapi(route, handler);
    });
  }

  return { routes, plugin, hono, name };
}
