import type { RawApiFetchArgs } from "./fetcher/raw";
import type {
  FetcherRequest,
  FetcherRequestOptions,
  FetcherResponse,
  PluginRouteMethod,
  RegisteredPluginId,
} from "./fetcher/types";

import { coreFetcher } from "./fetcher/core";
import { isRateLimited, notifyRateLimited } from "./fetcher/rate-limit";
import { rawApiFetch } from "./fetcher/raw";
import { CAPTCHA_TOKEN_HEADER } from "./fetcher/request-context";

export type { ApiPluginRegistry } from "./fetcher/registry";
export type {
  FetcherRequest,
  FetcherResponse,
  PluginModulePath,
  PluginRouteMethod,
  PluginRoutePath,
  RegisteredPluginId,
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
  Method extends string = PluginRouteMethod<P, M, Path>,
>({
  plugin,
  module,
  path,
  method,
  args,
  options,
  withPagination = false,
  captchaToken,
  formData,
}: FetcherClientOptions & FetcherRequest<P, M, Path, Method>): Promise<
  FetcherResponse<P, M, Path, Method>
> {
  const additionalHeaders: Record<string, string> = {};

  if (captchaToken) {
    additionalHeaders[CAPTCHA_TOKEN_HEADER] = captchaToken;
  }

  const response = await coreFetcher<P, M, Path, Method>({
    plugin,
    module,
    path,
    method,
    args,
    options: { credentials: "include", ...options },
    withPagination,
    additionalHeaders,
    formData,
  } as FetcherRequest<P, M, Path, Method> & FetcherRequestOptions);

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
