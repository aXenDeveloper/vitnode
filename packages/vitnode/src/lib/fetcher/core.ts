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

import { CONFIG } from "../config";
import { buildSearchParams } from "./helpers";

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
  }: CoreFetcherOptions<M, Routes, Modules, ModuleName, SelectedPath, Method>,
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  let currentPath: string = path;

  // Replace path parameters
  if (args && "params" in args && args.params) {
    for (const [key, value] of Object.entries(
      args.params as Record<string, unknown>,
    )) {
      currentPath = currentPath.replaceAll(`{${key}}`, String(value));
    }
  }

  // Ensure path starts with a slash
  const formattedPath = currentPath.startsWith("/")
    ? currentPath
    : `/${currentPath}`;

  // Construct the base URL
  const url = new URL(
    `/api/${pluginId}${prefixPath}/${module}${formattedPath === "/" ? "" : formattedPath}`,
    CONFIG.api.origin,
  );

  // Add query parameters if they exist
  if (args && "query" in args && args.query) {
    const queryParams = args.query as Record<string, string | string[]>;
    const searchParams = buildSearchParams({
      ...(args.query as Record<string, string | string[]>),
      ...(withPagination && {
        first: queryParams.last ? undefined : (queryParams.first ?? "10"),
        search: queryParams.search ?? "",
      }),
    });
    url.search = searchParams.toString();
  }

  // Build headers. For multipart uploads let the browser set the Content-Type
  // (with its boundary) — forcing application/json would corrupt the body.
  const headers = new Headers({
    ...(formData ? {} : { "Content-Type": "application/json" }),
    ...additionalHeaders,
  });

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body:
      formData ??
      (args && "body" in args ? JSON.stringify(args.body) : undefined),
    ...options,
  });

  if (response.status === 500) {
    const errorText = await response.text();
    throw new Error(
      `${response.status} - ${url.toString()}\n${response.statusText ?? errorText}`,
    );
  }

  if (response.status >= 400) {
    // Clone so the response body stays readable for the caller
    const errorText = await response.clone().text();
    // eslint-disable-next-line no-console
    console.error(
      `\x1b[34m[VitNode - API]\x1b[0m \x1b[31m${response.status}\x1b[0m - \x1b[33m${url.toString()}\x1b[0m\n\x1b[36mError: ${errorText}\x1b[0m`,
    );
  }

  return response as InferResponseType<
    M,
    Routes,
    Modules,
    ModuleName,
    SelectedPath
  >;
}
