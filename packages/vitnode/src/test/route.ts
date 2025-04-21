import { RouteConfig, RouteHandler } from '@hono/zod-openapi';

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
} => ({
  route: route as R & {
    getRoutingPath: () => RoutingPath<R['path']>;
  },
  handler,
});

export type Route<
  R extends RouteConfig = RouteConfig,
  H extends RouteHandler<R> = RouteHandler<R>,
> = readonly { handler: H; route: R }[];
