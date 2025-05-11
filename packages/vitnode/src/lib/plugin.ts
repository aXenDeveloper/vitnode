import { OpenAPIHono } from '@hono/zod-openapi';

import type { BuildModuleReturn } from '../api/lib/module';

export interface BuildPluginReturn {
  hono: OpenAPIHono;
  name: string;
}

export function buildPlugin<P extends string>({
  name,
  modules = [],
}: {
  modules?: BuildModuleReturn<P, string>[];
  name: P;
}): BuildPluginReturn {
  const hono = new OpenAPIHono();
  modules.forEach(handler => {
    hono.route(`/${handler.name}`, handler.hono);
  });

  return { name, hono };
}
