import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from "@/api/lib/module";
import type { Route } from "@/api/lib/route";

import type {
  FetcherParams,
  GetModulePaths,
  GetValidMethodForPath,
  GetValidPathsForModule,
  InferResponseType,
} from "./types";

import { rawApiFetch } from "./raw";

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
  >["args"];
  /**
   * Raw `multipart/form-data` body for file uploads. When set, the JSON
   * `Content-Type` is omitted so the browser can add the multipart boundary,
   * and this is sent as the request body instead of `JSON.stringify(args.body)`.
   */
  formData?: FormData;
  method: Method;
  module: ModuleName;
  options?: Omit<RequestInit, "body" | "headers">;
  /**
   * Origin to call, instead of the `NEXT_PUBLIC_API_URL` one. Set by a runtime
   * that serves the API itself and knows the origin only per request; see
   * `RawApiFetchArgs["origin"]`.
   */
  origin?: string;
  path: SelectedPath;
  prefixPath?: string;
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
    prefixPath = "",
    formData,
    origin,
  }: CoreFetcherOptions<M, Routes, Modules, ModuleName, SelectedPath, Method>,
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  const response = await rawApiFetch({
    additionalHeaders,
    body: args && "body" in args ? args.body : undefined,
    formData,
    method,
    module,
    options,
    origin,
    params:
      args && "params" in args
        ? (args.params as Record<string, unknown>)
        : undefined,
    path,
    pluginId,
    prefixPath,
    query:
      args && "query" in args
        ? (args.query as Record<string, string | string[]>)
        : undefined,
    withPagination,
  });

  return response as InferResponseType<
    M,
    Routes,
    Modules,
    ModuleName,
    SelectedPath
  >;
}
