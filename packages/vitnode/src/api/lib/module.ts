import { OpenAPIHono } from '@hono/zod-openapi';
import { Env, Schema } from 'hono';

export interface ModuleApi<
  E extends Env,
  T extends Schema,
  N extends string,
  P extends string,
> {
  app: OpenAPIHono<E, T, string>;
  name: N;
  plugin: P;
}

export function createModuleApi<
  E extends Env,
  S extends Schema = Schema,
  N extends string = string,
  P extends string = string,
>({
  name,
  plugin,
  routes,
}: {
  name: N;
  plugin: P;
  routes: OpenAPIHono<E, S, string>;
}): ModuleApi<E, S, N, P> {
  const current = routes;

  return {
    app: current,
    plugin,
    name,
  };
}
