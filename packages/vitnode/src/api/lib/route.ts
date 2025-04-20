import { PluginConfig } from '@/plugin.config';
import { createRoute as createRouteHono, RouteConfig } from '@hono/zod-openapi';
import { MiddlewareHandler } from 'hono';

import { sessionMiddleware } from '../middlewares/session';

type RoutingPath<P extends string> =
  P extends `${infer Head}/{${infer Param}}${infer Tail}`
    ? `${Head}/:${Param}${RoutingPath<Tail>}`
    : P;

export function createApiRoute<
  P extends string,
  R extends Omit<RouteConfig, 'path'> & {
    path: P;
  },
>({
  isAuth,
  pluginConfig,
  ...routeConfig
}: R & {
  isAuth?: boolean;
  pluginConfig: PluginConfig;
}): R & {
  getRoutingPath: () => RoutingPath<R['path']>;
} {
  const middlewareFromConfig: MiddlewareHandler[] = routeConfig.middleware
    ? Array.isArray(routeConfig.middleware)
      ? routeConfig.middleware
      : [routeConfig.middleware]
    : [];
  const tags: string[] = [pluginConfig.name, ...(routeConfig.tags ?? [])];

  return createRouteHono({
    middleware: isAuth ? [sessionMiddleware(), ...middlewareFromConfig] : [],
    tags,
    ...routeConfig,
  }) as unknown as R & {
    getRoutingPath: () => RoutingPath<R['path']>;
  };
}
