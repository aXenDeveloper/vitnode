import type {
  FetcherCall,
  FetcherRequestOptions,
  RegisteredPluginId,
  ResponseFor,
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
  Method extends string,
>({
  additionalHeaders = {},
  args,
  formData,
  method,
  module,
  options,
  origin,
  path,
  plugin,
  withPagination = false,
}: FetcherCall<P, M, Path, Method, FetcherRequestOptions>): Promise<
  ResponseFor<P, M, Path, Method>
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

  return response as ResponseFor<P, M, Path, Method>;
}
