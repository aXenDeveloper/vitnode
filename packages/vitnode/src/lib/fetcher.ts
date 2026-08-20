import "server-only";

import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from "@/api/lib/module";
import type { Route } from "@/api/lib/route";

import { forwardApiRequestHeaders } from "@/framework/request";

import type {
  FetcherParams,
  GetModulePaths,
  GetValidMethodForPath,
  GetValidPathsForModule,
  InferResponseType,
} from "./fetcher/types";

import { coreFetcher } from "./fetcher/core";
import { handleSetCookiesFetcher } from "./fetcher/helpers-server";

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
  moduleReturn: BuildModuleReturn<string, M, Routes, Modules>,
  {
    path,
    method,
    module,
    args,
    options,
    allowSaveCookies = false,
    withPagination = false,
    prefixPath = "",
    captchaToken,
  }: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> & {
    allowSaveCookies?: boolean;
    captchaToken?: string;
    options?: Omit<RequestInit, "body">;
    prefixPath?: string;
    withPagination?: boolean;
  },
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  const additionalHeaders = await forwardApiRequestHeaders();

  if (captchaToken) {
    additionalHeaders["x-vitnode-captcha-token"] = captchaToken;
  }

  const response = await coreFetcher(moduleReturn, {
    path,
    method,
    module,
    args,
    options,
    withPagination,
    prefixPath,
    additionalHeaders,
  });

  // Handle cookies on server-side for successful responses
  if (
    (response as Response).status >= 200 &&
    (response as Response).status < 300 &&
    allowSaveCookies
  ) {
    await handleSetCookiesFetcher(response);
  }

  return response;
}
