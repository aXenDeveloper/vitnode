import { OpenAPIHono } from '@hono/zod-openapi';

import { BuildModuleReturn } from './module';

export interface BuildPluginReturn {
  hono: OpenAPIHono;
  name: string;
}

export function buildPlugin<P extends string>({
  name,
  modules = [],
}: {
  modules?: BuildModuleReturn<P>[];
  name: P;
}): BuildPluginReturn {
  const hono = new OpenAPIHono();
  modules.forEach(handler => {
    hono.route(`/${handler.name}`, handler.hono);
  });

  return { name, hono };
}
