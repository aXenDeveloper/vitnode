import { OpenAPIHono } from '@hono/zod-openapi';
import { Env, Hono, Schema } from 'hono';
import { ClientRequest, hc } from 'hono/client';
import { HonoBase } from 'hono/hono-base';
import { UnionToIntersection } from 'hono/utils/types';

/**
 * Create a type-safe client for a VitNode API module.
 * @param plugin - The plugin name (e.g. 'core')
 * @param module - The module name (e.g. 'users')
 * @param options - Optional fetch options
 */
export async function fetcherNew<T extends OpenAPIHono>({
  plugin,
  module,
  options,
}: {
  module: string;
  options?: Omit<RequestInit, 'body'>;
  plugin: string;
}) {}
