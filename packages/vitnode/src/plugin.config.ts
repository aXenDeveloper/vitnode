import { OpenAPIHono } from '@hono/zod-openapi';

export interface VitNodePlugin {
  id: string;
  routes: OpenAPIHono[];
}

export type PluginConfigReturn = VitNodePlugin;

export function buildPluginConfig(args: VitNodePlugin): PluginConfigReturn {
  return {
    ...args,
  };
}

export interface PluginConfig {
  id: string;
  name: string;
}
