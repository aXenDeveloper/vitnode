import { BaseBuildModuleReturn, BuildModuleReturn } from '@/api/lib/module';
import { Route } from '@/api/lib/route';
import { cookies, headers } from 'next/headers';

import { CONFIG } from '../config';
import { cookieFromStringToObject } from '../cookie-from-string-to-object';
import {
  FetcherParams,
  GetModulePaths,
  GetValidPathsForModule,
  InferResponseType,
} from '../fetcher/types';

const handleSetCookiesFetcher = async (res: Response) => {
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
};

const buildSearchParams = (query: Record<string, string | string[]>) => {
  const searchParams = new URLSearchParams();

  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) {
      continue;
    }

    if (Array.isArray(v)) {
      for (const v2 of v) {
        searchParams.append(k, v2);
      }
    } else {
      searchParams.set(k, v);
    }
  }

  return searchParams;
};

export async function fetcher<
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
  ModuleName extends GetModulePaths<M, Modules>,
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
>(
  { plugin }: BuildModuleReturn<string, M, Routes, Modules>,
  {
    path,
    method,
    module,
    args,
    options,
    allowSaveCookies = false,
  }: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath> & {
    allowSaveCookies?: boolean;
    options?: Omit<RequestInit, 'body'>;
  },
): Promise<InferResponseType<M, Routes, Modules, ModuleName, SelectedPath>> {
  let currentPath: string = path;

  // Replace path parameters
  if (args && 'params' in args && args.params) {
    for (const [key, value] of Object.entries(args.params)) {
      currentPath = currentPath.replaceAll(`{${key}}`, String(value));
    }
  }

  // Ensure path starts with a slash
  const formattedPath = currentPath.startsWith('/')
    ? currentPath
    : `/${currentPath}`;

  // Construct the base URL
  const url = new URL(
    `/api/${plugin}/${module}${formattedPath}`,
    CONFIG.backend.origin,
  );

  // Add query parameters if they exist
  if (args && 'query' in args && args.query) {
    const searchParams = buildSearchParams(
      args.query as Record<string, string | string[]>,
    );
    url.search = searchParams.toString();
  }

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
    body: args && 'body' in args ? JSON.stringify(args.body) : undefined,
    ...options,
  });

  if (
    response.status >= 200 &&
    response.status < 300 &&
    allowSaveCookies &&
    method !== 'get'
  ) {
    await handleSetCookiesFetcher(response);
  }

  return response as InferResponseType<
    M,
    Routes,
    Modules,
    ModuleName,
    SelectedPath
  >;
}
