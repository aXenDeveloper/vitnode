import type { RawApiFetchArgs } from "./fetcher/raw";
import type {
  FetcherCall,
  FetcherRequestOptions,
  RegisteredPluginId,
  ResponseFor,
} from "./fetcher/types";

import { coreFetcher } from "./fetcher/core";
import { isRateLimited, notifyRateLimited } from "./fetcher/rate-limit";
import { rawApiFetch } from "./fetcher/raw";
import { CAPTCHA_TOKEN_HEADER } from "./fetcher/request-context";

export type { ApiEndpoint, ApiPluginContract } from "./fetcher/contract";
export type { ApiPluginRegistry } from "./fetcher/registry";
export type {
  AllEndpoints,
  ApiRequest,
  PluginEndpoints,
  PluginModulePath,
  PluginRouteMethod,
  PluginRoutePath,
  RegisteredPluginId,
  ResponseFor,
} from "./fetcher/types";

export type FetcherClientOptions = Omit<
  FetcherRequestOptions,
  "additionalHeaders" | "origin"
> & {
  captchaToken?: string;
};

export async function fetcherClient<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
>({
  args,
  captchaToken,
  formData,
  method,
  module,
  options,
  path,
  plugin,
  withPagination = false,
}: FetcherCall<P, M, Path, Method, FetcherClientOptions>): Promise<
  ResponseFor<P, M, Path, Method>
> {
  const additionalHeaders: Record<string, string> = {};

  if (captchaToken) {
    additionalHeaders[CAPTCHA_TOKEN_HEADER] = captchaToken;
  }

  const response = await coreFetcher<P, M, Path, Method>({
    additionalHeaders,
    args,
    formData,
    method,
    module,
    options: { credentials: "include", ...options },
    path,
    plugin,
    withPagination,
  } as FetcherCall<P, M, Path, Method, FetcherRequestOptions>);

  if (isRateLimited(response)) {
    notifyRateLimited(response);
  }

  return response;
}

/**
 * The one signature a fetch can have in **both** runtimes.
 *
 * The browser's, deliberately: it is the narrower of the two, so a call typed
 * against it carries no `allowSaveCookies`, no forwarded headers and no origin
 * override - none of which a browser can honour. `tanstack/fetcher`'s universal
 * `fetcher` and this module's `fetcherClient` both satisfy it, which is what
 * lets a feature take its transport as an argument.
 */
export type UniversalFetcher = typeof fetcherClient;

/** {@link RawApiFetchArgs} minus the two fields only a server can act on. */
export type UniversalRawFetchArgs = Omit<
  RawApiFetchArgs,
  "additionalHeaders" | "origin"
>;

/**
 * An untyped call from the browser - the Content Engine's generated modules.
 *
 * `credentials: "include"` for the reason `fetcherClient` has it: the API's
 * origin may be a separate host, and a cross-origin `fetch` sends no cookie
 * without it.
 */
export const rawFetcherClient = async ({
  options,
  ...args
}: UniversalRawFetchArgs): Promise<Response> =>
  await rawApiFetch({
    ...args,
    options: { credentials: "include", ...options },
  });

/** The {@link UniversalFetcher} of untyped calls. See {@link rawFetcherClient}. */
export type UniversalRawFetcher = typeof rawFetcherClient;
