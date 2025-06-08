import { OpenAPIHono } from '@hono/zod-openapi';

import type { BuildModuleReturn } from './module';

import { checkPluginId } from './check-plugin-id';

export interface BuildPluginApiReturn {
  hono: OpenAPIHono;
  pluginId: string;
}

export function buildApiPlugin<P extends string>({
  pluginId,
  modules = [],
}: {
  modules?: BuildModuleReturn<P, string>[];
  pluginId: P;
}): BuildPluginApiReturn {
  // Run for checking if the plugin is valid
  checkPluginId(pluginId);

  const hono = new OpenAPIHono();
  modules.forEach(handler => {
    hono.route(`/${handler.name}`, handler.hono);
  });

  return {
    pluginId,
    hono,
  };
}
