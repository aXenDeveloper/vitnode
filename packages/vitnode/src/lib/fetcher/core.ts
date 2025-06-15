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
} from './types';

import { CONFIG } from '../config';
import { buildSearchParams } from './helpers';

interface CoreFetcherOptions<
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
> {
  additionalHeaders?: HeadersInit;
  args?: FetcherParams<
    M,
    Routes,
    Modules,
    ModuleName,
    SelectedPath,
    Method
  >['args'];
  method: Method;
  module: ModuleName;
  options?: Omit<RequestInit, 'body' | 'headers'>;
  path: SelectedPath;
  withPagination?: boolean;
}

export async function coreFetcher<
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
    additionalHeaders = {},
    withPagination = false,
  }: CoreFetcherOptions<M, Routes, Modules, ModuleName, SelectedPath, Method>,
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  let currentPath: string = path;

  // Replace path parameters
  if (args && 'params' in args && args.params) {
    for (const [key, value] of Object.entries(
      args.params as Record<string, unknown>,
    )) {
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
      ...(args.query as Record<string, string | string[]>),
      ...(withPagination && {
        first: !queryParams.last ? (queryParams.first ?? '10') : undefined,
        search: queryParams.search ?? '',
      }),
    });
    url.search = searchParams.toString();
  }

  // Build headers
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...additionalHeaders,
  });

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body: args && 'body' in args ? JSON.stringify(args.body) : undefined,
    ...options,
  });

  return response as InferResponseType<
    M,
    Routes,
    Modules,
    ModuleName,
    SelectedPath
  >;
}
