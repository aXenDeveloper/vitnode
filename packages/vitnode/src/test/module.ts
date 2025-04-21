import { OpenAPIHono } from '@hono/zod-openapi';

import { Route } from './route';

export interface BuildModuleType<T extends Route, Plugin extends string> {
  plugin: Plugin;
  routes: T;
}

export function buildModule<
  const Routes extends Route,
  const P extends string,
>({ routes, plugin }: { plugin: P; routes: Routes }) {
  const hono = new OpenAPIHono();

  routes.forEach(({ handler, route }) => {
    hono.openapi(route, handler);
  });

  return { routes, plugin, hono };
}
