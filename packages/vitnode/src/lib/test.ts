import { Env, Hono, Schema } from 'hono';
import { HonoBase } from 'hono/hono-base';

type Client<T> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends HonoBase<any, infer S, any>
    ? S extends Record<infer K, Schema>
      ? K extends string
        ? string
        : never
      : never
    : never;

export function fetcher<T extends Hono<Env, Schema, string>>(): Client<T> {
  // const client = hc('https://example.com');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return '' as any as Client<T>;
}
