import { OpenAPIHono } from '@hono/zod-openapi';
import { ClientRequest, hc } from 'hono/client';
import { UnionToIntersection } from 'hono/utils/types';
import { cookies, headers } from 'next/headers';

import { CONFIG } from './config';
import { Env, Schema } from 'hono';
import { HonoBase } from 'hono/hono-base';

/**
 * Maps an API path string to a nested object structure for type-safe client usage.
 * Example: '/foo/bar' -> { foo: { bar: ... } }
 * This is intentionally shallow to avoid deep recursion for TS perf.
 */
type PathToChain<
  Path extends string,
  E extends Schema,
  Orig extends string = Path,
> = Path extends `/${infer P}`
  ? PathToChain<P, E, Path>
  : Path extends `${infer P}/${infer R}`
    ? { [K in P]: PathToChain<R, E, Orig> }
    : Record<
        Path extends '' ? 'index' : Path,
        ClientRequest<E extends Record<string, unknown> ? E[Orig] : never>
      >;

/**
 * Type-safe client for a Hono API schema.
 */
export type Client<T> =
  T extends HonoBase<Env, infer S, string>
    ? S extends Record<infer K, Schema>
      ? K extends string
        ? PathToChain<K, S>
        : never
      : never
    : never;

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
}): Promise<UnionToIntersection<Client<T>>> {
  const url = new URL(`/api/${plugin}/${module}`, CONFIG.backend.origin);
  const [nextInternalHeaders, cookie] = await Promise.all([
    headers(),
    cookies(),
  ]);

  const client = hc<T>(url.href, {
    fetch: async (input, requestInit) => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        Cookie: cookie.toString(),
        ['user-agent']: nextInternalHeaders.get('user-agent') ?? 'node',
        ['x-forwarded-for']:
          nextInternalHeaders.get('x-forwarded-for') ?? '0.0.0.0',
        ...options?.headers,
      });

      return await fetch(input, {
        ...requestInit,
        ...options,
        headers,
      });
    },
  });

  return client as unknown as UnionToIntersection<Client<T>>;
}
