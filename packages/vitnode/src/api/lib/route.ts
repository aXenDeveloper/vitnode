import {
  createRoute as createRouteHono,
  RouteConfig,
  RouteHandler,
} from '@hono/zod-openapi';

import { sessionMiddleware } from '../middlewares/session';

type RoutingPath<P extends string> =
  P extends `${infer Head}/{${infer Param}}${infer Tail}`
    ? `${Head}/:${Param}${RoutingPath<Tail>}`
    : P;

type ValidHandler<R extends RouteConfig> = (
  c: Parameters<RouteHandler<R>>[0],
) => ReturnType<RouteHandler<R>>;

export const buildRoute = <
  Plugin extends string,
  P extends string,
  R extends Omit<RouteConfig, 'path'> & {
    isAuthorization?: boolean;
    path: P;
  },
  H extends ValidHandler<R & { path: P }>,
>({
  route,
  handler,
  plugin,
}: {
  handler: H;
  plugin: Plugin;
  route: R;
}): {
  handler: H;
  plugin: Plugin;
  route: R & {
    getRoutingPath: () => RoutingPath<R['path']>;
  };
} => {
  const { isAuthorization, middleware, ...restOfRoute } = route;
  const pluginTag = plugin
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const tags = [pluginTag, ...(route.tags ?? [])];
  const middlewareArray = middleware
    ? Array.isArray(middleware)
      ? middleware
      : [middleware]
    : [];

  return {
    route: createRouteHono({
      middleware: isAuthorization
        ? [sessionMiddleware(), ...middlewareArray]
        : middlewareArray,
      tags,
      ...restOfRoute,
    }) as R & {
      getRoutingPath: () => RoutingPath<R['path']>;
    },
    handler,
    plugin,
  };
};

export interface Route<
  Plugin extends string = string,
  R extends RouteConfig = RouteConfig,
  H extends RouteHandler<R> = RouteHandler<R>,
> {
  handler: H;
  plugin: Plugin;
  route: R;
}
