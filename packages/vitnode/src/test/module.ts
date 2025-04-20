import {
  createRoute,
  OpenAPIHono,
  RouteConfig,
  RouteHandler,
  z,
} from '@hono/zod-openapi';

export const withHandler = <R extends RouteConfig, H extends RouteHandler<R>>({
  route,
  handler,
}: {
  handler: H;
  route: R;
}) => ({ route, handler });

type Route<
  R extends RouteConfig = RouteConfig,
  H extends RouteHandler<R> = RouteHandler<R>,
> = readonly { handler: H; route: R }[];

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

export const test = buildModule({
  plugin: 'test_plugin',
  routes: [
    withHandler({
      route: createRoute({
        path: '/test34',
        method: 'get',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ message: z.string() }),
              },
            },
          },
        },
      }),
      handler: c => c.json({ message: 'Success' }),
    }),
    withHandler({
      route: createRoute({
        path: '/test2',
        method: 'post',
        responses: {
          200: {
            description: 'Success 2',
            content: {
              'application/json': {
                schema: z.object({
                  message: z.string(),
                }),
              },
            },
          },
        },
      }),
      handler: c => {
        return c.json({
          message: `Hello from ${c.req.path}`,
        });
      },
    }),
  ],
});

type Test = typeof test;

type FetcherParams<
  T extends { plugin: string; routes: Route },
  R extends T['routes'][number],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = R extends any
  ? Pick<R['route'], 'method' | 'path'> & { plugin: T['plugin'] }
  : never;

function fetcher<T extends { plugin: string; routes: Route }>(
  params: FetcherParams<T, T['routes'][number]>,
) {
  const { path, method, plugin } = params;
}

export const testFetcher = () => {
  fetcher<Test>({ path: '/test34', method: 'get', plugin: 'test_plugin' });
  fetcher<Test>({ path: '/test2', method: 'post', plugin: 'test_plugin' });
};
