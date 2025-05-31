import { OpenAPIHono } from '@hono/zod-openapi';

import type { BuildModuleReturn } from './module';

import { checkPluginId } from './check-plugin-id';

export interface BuildPluginApiReturn {
  hono: OpenAPIHono;
  id: string;
}

export function buildApiPlugin<P extends string>({
  id,
  modules = [],
}: {
  id: P;
  modules?: BuildModuleReturn<P, string>[];
}): BuildPluginApiReturn {
  // Run for checking if the plugin is valid
  checkPluginId(id);

  const hono = new OpenAPIHono();
  modules.forEach(handler => {
    hono.route(`/${handler.name}`, handler.hono);
  });

  return {
    id,
    hono,
  };
}
