import { PluginConfig } from '@/plugin.config';
import {
  createRoute as createRouteHono,
  RouteConfig,
  RouteHandler,
} from '@hono/zod-openapi';
import { MiddlewareHandler } from 'hono';

import { sessionMiddleware } from '../middlewares/session';

function createApiRoute<
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

// ===============

type RoutingPath<P extends string> =
  P extends `${infer Head}/{${infer Param}}${infer Tail}`
    ? `${Head}/:${Param}${RoutingPath<Tail>}`
    : P;

type ValidHandler<R extends RouteConfig> = (
  c: Parameters<RouteHandler<R>>[0],
) => ReturnType<RouteHandler<R>>;

export const buildRoute = <
  P extends string,
  R extends Omit<RouteConfig, 'path'> & {
    path: P;
  },
  H extends ValidHandler<R & { path: P }>,
>({
  route,
  handler,
}: {
  handler: H;
  route: R;
}): {
  handler: H;
  route: R & {
    getRoutingPath: () => RoutingPath<R['path']>;
  };
} => {
  const tags: string[] = ['test123 from createRoute', ...(route.tags ?? [])];

  return {
    route: {
      ...route,
      tags,
    } as R & {
      getRoutingPath: () => RoutingPath<R['path']>;
    },
    handler,
  };
};

export type Route<
  R extends RouteConfig = RouteConfig,
  H extends RouteHandler<R> = RouteHandler<R>,
> = readonly { handler: H; route: R }[];
