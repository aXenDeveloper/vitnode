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

import { coreFetcher } from './fetcher/core';

export async function fetcherClient<
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
  moduleReturn: BuildModuleReturn<string, M, Routes, Modules>,
  {
    path,
    method,
    module,
    args,
    options,
    withPagination = false,
    prefixPath = '',
    captchaToken,
  }: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> & {
    captchaToken?: string;
    options?: Omit<RequestInit, 'body'>;
    prefixPath?: string;
    withPagination?: boolean;
  },
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  const additionalHeaders: Record<string, string> = {};

  if (captchaToken) {
    additionalHeaders['x-vitnode-captcha-token'] = captchaToken;
  }

  return coreFetcher(moduleReturn, {
    path,
    method,
    module,
    args,
    options,
    withPagination,
    prefixPath,
    additionalHeaders,
  });
}
