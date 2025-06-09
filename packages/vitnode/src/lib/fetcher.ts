import { cookies, headers } from 'next/headers';

import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from '@/api/lib/module';
import type { Route } from '@/api/lib/route';

import type {
  FetcherParams,
  GetModulePaths,
  GetValidMethodForPath,
  GetValidPathsForModule,
  InferResponseType,
} from './fetcher/types';

import { CONFIG } from './config';
import { buildSearchParams, handleSetCookiesFetcher } from './fetcher/helpers';

export async function fetcher<
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
  ModuleName extends GetModulePaths<M, Modules>,
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
  Method extends GetValidMethodForPath<
    ModuleName,
    SelectedPath,
    M,
    Routes,
    Modules
  > = GetValidMethodForPath<ModuleName, SelectedPath, M, Routes, Modules>,
>(
  { pluginId }: BuildModuleReturn<string, M, Routes, Modules>,
  {
    path,
    method,
    module,
    args,
    options,
    allowSaveCookies = false,
    withPagination = false,
  }: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> & {
    allowSaveCookies?: boolean;
    options?: Omit<RequestInit, 'body'>;
    withPagination?: boolean;
  },
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
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
    `/api/${pluginId}/${module}${formattedPath}`,
    CONFIG.backend.origin,
  );

  // Add query parameters if they exist
  if (args && 'query' in args && args.query) {
    const queryParams = args.query as Record<string, string | string[]>;
    const searchParams = buildSearchParams({
      ...args.query,
      ...(withPagination && {
        first: !queryParams.last ? (queryParams.first ?? '10') : undefined,
        search: queryParams.search ?? '',
      }),
    });
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

  if (response.status >= 200 && response.status < 300 && allowSaveCookies) {
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
