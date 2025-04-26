import { BuildModuleReturn } from '@/api/lib/module';
import { Route } from '@/api/lib/route';
import { CONFIG } from '@/lib/config';
import { cookies, headers } from 'next/headers';

type FetcherParams<
  T extends { name: string; plugin: string; routes: Route[] },
  R extends T['routes'][number],
> = R extends T['routes'][number]
  ? Pick<R['route'], 'method' | 'path'> & {
      input?: string;
      module: T['name'];
      plugin: T['plugin'];
    }
  : never;

export async function fetcher<
  T extends BuildModuleReturn<P, M>,
  P extends string = T['plugin'],
  M extends string = T['name'],
>({
  path,
  method,
  plugin,
  module,
  input,
}: FetcherParams<T, T['routes'][number]>): Promise<{ data: never }> {
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(
    `/api/${plugin}/${module}${formattedPath}`,
    CONFIG.backend.origin,
  );
  const [nextInternalHeaders, cookie] = await Promise.all([
    headers(),
    cookies(),
  ]);

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers: new Headers({
      'Content-Type': 'application/json',
      Cookie: cookie.toString(),
      ['user-agent']: nextInternalHeaders.get('user-agent') ?? 'node',
      ['x-forwarded-for']:
        nextInternalHeaders.get('x-forwarded-for') ?? '0.0.0.0',
    }),
  });

  const returnValue = {
    clone: response.clone,
  };

  // JSON response
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    return {
      data: '',
      format: 'json',
      ...returnValue,
    };
  }

  // const data = await res.json();

  return { data: '', format: 'text', ...returnValue };
}
