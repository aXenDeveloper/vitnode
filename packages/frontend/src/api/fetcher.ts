import 'server-only';
import { CONFIG } from '@/helpers/config-with-env';
import { cookies, headers as nextHeaders } from 'next/headers';

import { buildFilteredQuery } from './helpers';

const cookieFromStringToObject = (
  str: string[],
): {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  [key: string]: 'lax' | 'none' | 'strict' | boolean | string | undefined;
  Domain: string;
  Expires: string;
  HttpOnly: boolean;
  Path: string;
  SameSite: 'lax' | 'none' | 'strict' | boolean | undefined;
  Secure: boolean;
}[] => {
  return str.map(item =>
    Object.fromEntries(
      item.split('; ').map(v => {
        const current = v.split(/=(.*)/s).map(decodeURIComponent);

        if (current.length === 1) {
          return [current[0], true];
        }

        return current;
      }),
    ),
  );
};

export const setCookieFromApi = ({ res }: { res: Response }) => {
  cookieFromStringToObject(res.headers.getSetCookie()).forEach(async cookie => {
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
  });
};

export async function fetcher<
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-explicit-any
  TData extends Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TVariable extends Record<string, any> = Record<string, any>,
>({
  url,
  body,
  query: queryFromArgs,
  ...options
}: {
  body?: TVariable;
  query?: TVariable;
  url: string;
} & Omit<RequestInit, 'body'>): Promise<{
  data: TData;
  res: Response;
}> {
  const [nextInternalHeaders, cookie] = await Promise.all([
    nextHeaders(),
    cookies(),
  ]);

  const internalHeaders = {
    Cookie: cookie.toString(),
    ['user-agent']: nextInternalHeaders.get('user-agent') ?? 'node',
    ['x-forwarded-for']:
      nextInternalHeaders.get('x-forwarded-for') ?? '0.0.0.0',
    ['x-real-ip']: nextInternalHeaders.get('x-real-ip') ?? '0.0.0.0',
    'x-vitnode-user-language': cookie.get('NEXT_LOCALE')?.value ?? 'en',
  };

  const query = queryFromArgs ? buildFilteredQuery(queryFromArgs) : '';
  const href = `${CONFIG.backend_url}${url}${query ? `?${query}` : ''}`;
  const method = options?.method ?? 'GET';
  const res = await fetch(href, {
    ...options,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders,
      ...options?.headers,
    },
    cache: 'no-store',
    body: body ? JSON.stringify(body) : null,
  });

  if (method !== 'GET') {
    setCookieFromApi({ res });
  }

  let data = {} as TData;
  try {
    data = await res.json();
  } catch (_) {
    /* empty */
  }

  if (!res.ok) {
    const error = data as unknown as { message: string; statusCode: number };
    throw new Error(`${error.statusCode} - ${error.message}`);
  }

  return { res, data };
}
