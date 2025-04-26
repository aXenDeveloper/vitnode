/* eslint-disable no-console */
import { BuildModuleReturn } from '@/api/lib/module';
import { OpenAPIHono } from '@hono/zod-openapi';
import { UnionToIntersection } from 'hono/utils/types';

import type { Client } from './client/types';

const createProxy = (
  callback: (opts: { args: unknown[]; path: string[] }) => unknown,
  path: string[],
) => {
  const proxy = new Proxy(() => {}, {
    get(_obj, key) {
      if (typeof key !== 'string' || key === 'then') {
        return undefined;
      }

      return createProxy(callback, [...path, key]);
    },
    apply(_1, _2, args) {
      return callback({
        path,
        args,
      });
    },
  });

  return proxy;
};

type UnionFromArrays<T extends any[]> = T[number] extends (infer U)[]
  ? U
  : T[number];

export function fetcher<T extends BuildModuleReturn>() {
  return createProxy(async function proxyCallback(args) {
    const paths = args.path;

    let method = '';
    const lastPartAt0 = paths.at(-1);
    if (lastPartAt0 && /^\$/.test(lastPartAt0)) {
      const last = paths.pop();
      if (last) {
        method = last.replace(/^\$/, '');
      }
    }

    const path = paths.join('/');

    const test = await fetch('http://localhost:3000/' + path);

    if (method === 'ws') {
      // TODO: implement ws
    }

    console.log('args', args);
    console.log('paths', paths);
    console.log('method', method);
    console.log('path', path);

    return '';
    // }, []) as UnionToIntersection<Client<T>>;
  }, []) as UnionToIntersection<T['routes'][number]>;
}
