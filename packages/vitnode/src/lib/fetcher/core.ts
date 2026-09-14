import type {
  FetcherRequest,
  FetcherRequestOptions,
  FetcherResponse,
  PluginRouteMethod,
  RegisteredPluginId,
} from "./types";

import { rawApiFetch } from "./raw";

interface FetcherInput {
  body?: unknown;
  params?: Record<string, unknown>;
  query?: Record<string, string | string[]>;
}

export async function coreFetcher<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string = PluginRouteMethod<P, M, Path>,
>({
  plugin,
  module,
  path,
  method,
  args,
  options,
  additionalHeaders = {},
  withPagination = false,
  formData,
  origin,
}: FetcherRequest<P, M, Path, Method> & FetcherRequestOptions): Promise<
  FetcherResponse<P, M, Path, Method>
> {
  const input = args as FetcherInput | undefined;

  const response = await rawApiFetch({
    additionalHeaders,
    body: input?.body,
    formData,
    method,
    module,
    options,
    origin,
    params: input?.params,
    path,
    pluginId: plugin,
    query: input?.query,
    withPagination,
  });

  return response as FetcherResponse<P, M, Path, Method>;
}
