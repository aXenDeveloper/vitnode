import { ModuleApi } from '@/api/lib/module';
import { Env, Schema } from 'hono';
import { hc } from 'hono/client';
import { UnionToIntersection } from 'hono/utils/types';

import { CONFIG } from './config';
import { Client } from './fetcher';

export function fetcherClient<
  T extends ModuleApi<Env, Schema, string, string>,
>({
  plugin,
  module,
  options,
}: {
  module: T['name'];
  options?: Omit<RequestInit, 'body'>;
  plugin: T['plugin'];
}): UnionToIntersection<Client<T['app']>> {
  const url = new URL(`/api/${plugin}/${module}`, CONFIG.backend.origin);

  const client = hc<T['app']>(url.href, {
    fetch: async (input, requestInit) => {
      return fetch(input, {
        ...requestInit,
        ...options,
      });
    },
  });

  return client as unknown as UnionToIntersection<Client<T['app']>>;
}
