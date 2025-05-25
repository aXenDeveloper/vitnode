import { OpenAPIHono } from '@hono/zod-openapi';

import type { BuildModuleReturn } from './module';

import { getPluginPackageJson } from '../../lib/get-plugin-package-json';

export interface BuildPluginApiReturn {
  hono: OpenAPIHono;
  name: string;
}

export function buildApiPlugin<P extends string>({
  name,
  modules = [],
}: {
  modules?: BuildModuleReturn<P, string>[];
  name: P;
}): BuildPluginApiReturn {
  // Run for checking if the plugin is valid
  getPluginPackageJson(name);

  const hono = new OpenAPIHono();
  modules.forEach(handler => {
    hono.route(`/${handler.name}`, handler.hono);
  });

  return {
    name: name,
    hono,
  };
}
