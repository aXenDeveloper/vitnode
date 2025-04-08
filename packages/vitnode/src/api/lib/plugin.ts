import { OpenAPIHono } from '@hono/zod-openapi';
import { Env, Schema } from 'hono';

import { ModuleApi } from './module';

export interface PluginAPI<T extends Schema, Plugin extends string> {
  app: OpenAPIHono<Env, T, string>;
  name: Plugin;
}

export function createPluginApi<
  T extends Schema,
  E extends Env = Env,
  Plugin extends string = string,
>({
  name,
  modules,
}: {
  modules: ModuleApi<E, T, string, Plugin>[];
  name: Plugin;
}): PluginAPI<T, Plugin> {
  const root = new OpenAPIHono();
  modules.forEach(handler => {
    root.route(`/${handler.name}`, handler.app);
  });

  return {
    name,
    app: root,
  };
}
