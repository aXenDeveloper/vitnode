import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from "@/api/lib/module";
import type { Route } from "@/api/lib/route";

import type {
  FetcherParams,
  FetcherRequestOptions,
  GetModulePaths,
  GetValidMethodForPath,
  GetValidPathsForModule,
  InferResponseType,
} from "./fetcher/types";

import { coreFetcher } from "./fetcher/core";
import { isRateLimited, notifyRateLimited } from "./fetcher/rate-limit";
import { CAPTCHA_TOKEN_HEADER } from "./fetcher/request-context";

export const clientModule = <T extends BaseBuildModuleReturn>(
  pluginId: T["pluginId"],
): T => ({ pluginId }) as unknown as T;

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
    prefixPath = "",
    captchaToken,
    formData,
  }: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> &
    Omit<FetcherRequestOptions, "additionalHeaders" | "origin"> & {
      captchaToken?: string;
    },
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  const additionalHeaders: Record<string, string> = {};

  if (captchaToken) {
    additionalHeaders[CAPTCHA_TOKEN_HEADER] = captchaToken;
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
    formData,
  } as FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> &
    FetcherRequestOptions);

  if (isRateLimited(response)) {
    notifyRateLimited(response);
  }

  return response;
}
