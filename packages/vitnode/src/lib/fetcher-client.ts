import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from "@/api/lib/module";
import type { Route } from "@/api/lib/route";

import type { RawApiFetchArgs } from "./fetcher/raw";
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
import { rawApiFetch } from "./fetcher/raw";
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
    options: { credentials: "include", ...options },
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
