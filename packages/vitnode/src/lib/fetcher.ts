// --- VitNode Fetcher Types & Utilities ---
// These types are optimized for TypeScript performance and readability.
// Avoid deep recursion and keep type-level logic as flat as possible.

import { ModuleApi } from '@/api/lib/module';
import { ClientRequest, ClientResponse, hc } from 'hono/client';
import { HonoBase } from 'hono/hono-base';
import { Env, ResponseFormat, Schema } from 'hono/types';
import { StatusCode } from 'hono/utils/http-status';
import { UnionToIntersection } from 'hono/utils/types';
import { cookies, headers } from 'next/headers';

import { CONFIG } from './config';
import { cookieFromStringToObject } from './cookie-from-string-to-object';

// --- Type Utilities ---

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
 * Type alias for extracting the schema from a ModuleApi.
 */
type SchemaOf<E extends Env, T extends ModuleApi<E, Schema, string, string>> =
  T extends ModuleApi<E, infer S, string, string> ? S : never;

/**
 * Extracts available HTTP methods for a given endpoint path.
 */
type MethodsForEndpoint<
  E extends Env,
  T extends ModuleApi<E, Schema, string, string>,
  P extends keyof SchemaOf<E, T>,
> = {
  [K in Extract<keyof SchemaOf<E, T>[P], `$${string}`>]: K extends `$${infer U}`
    ? Lowercase<U>
    : never;
}[Extract<keyof SchemaOf<E, T>[P], `$${string}`>];

/**
 * Type-safe input for a fetcher endpoint method.
 */
export type FetcherInput<
  T extends ModuleApi<E, Schema, string, string>,
  P extends keyof SchemaOf<E, T>,
  M extends MethodsForEndpoint<E, T, P>,
  E extends Env = Env,
> = {
  [K in Extract<keyof SchemaOf<E, T>[P], `$${string}`>]: Lowercase<
    K extends `$${infer U}` ? U : never
  > extends M
    ? SchemaOf<E, T>[P][K] extends { input: infer I }
      ? I
      : never
    : never;
}[Extract<keyof SchemaOf<E, T>[P], `$${string}`>];

// --- Fetcher Implementation ---

/**
 * Create a type-safe client for a VitNode API module.
 * @param plugin - The plugin name (e.g. 'core')
 * @param module - The module name (e.g. 'users')
 * @param options - Optional fetch options
 */
export async function fetcher<
  T extends ModuleApi<Env, Schema, string, string>,
>({
  plugin,
  module,
  options,
}: {
  module: T['name'];
  options?: Omit<RequestInit, 'body'>;
  plugin: T['plugin'];
}): Promise<UnionToIntersection<Client<T['app']>>> {
  const url = new URL(`/api/${plugin}/${module}`, CONFIG.backend.origin);
  const [nextInternalHeaders, cookie] = await Promise.all([
    headers(),
    cookies(),
  ]);

  const client = hc<T['app']>(url.href, {
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

  return client as unknown as UnionToIntersection<Client<T['app']>>;
}

/**
 * Handles setting cookies from a Hono client response in Next.js server context.
 */
export async function handleSetCookiesFetcher<
  T,
  U extends number = StatusCode,
  F extends ResponseFormat = string,
>(res: ClientResponse<T, U, F>) {
  await Promise.all(
    cookieFromStringToObject(res.headers.getSetCookie()).map(async cookie => {
      const key = Object.keys(cookie)[0];
      const value = Object.values(cookie)[0];

      if (typeof value !== 'string' || typeof key !== 'string') return;

      (await cookies()).set(key, value, {
        domain: cookie.Domain,
        path: cookie.Path,
        expires: new Date(cookie.Expires),
        secure: cookie.Secure,
        httpOnly: cookie.HttpOnly,
        sameSite: cookie.SameSite,
      });
    }),
  );
}
