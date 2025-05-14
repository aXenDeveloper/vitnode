import { OpenAPIHono } from '@hono/zod-openapi';

import type { BuildModuleReturn } from './module';

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
  const hono = new OpenAPIHono();
  modules.forEach(handler => {
    hono.route(`/${handler.name}`, handler.hono);
  });

  return { name, hono };
}
