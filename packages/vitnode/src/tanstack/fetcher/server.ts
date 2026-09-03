import "@tanstack/react-start/server-only";
import {
  getRequestHeaders,
  getRequestIP,
  getRequestUrl,
  setCookie,
} from "@tanstack/react-start/server";
import { config } from "dotenv";

import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from "@/api/lib/module";
import type { Route } from "@/api/lib/route";
import type { RawApiFetchArgs } from "@/lib/fetcher/raw";
import type {
  FetcherParams,
  FetcherRequestOptions,
  GetModulePaths,
  GetValidMethodForPath,
  GetValidPathsForModule,
  InferResponseType,
} from "@/lib/fetcher/types";

import { CONFIG } from "@/lib/config";
import { coreFetcher } from "@/lib/fetcher/core";
import { rawApiFetch } from "@/lib/fetcher/raw";
import { buildForwardedHeaders } from "@/lib/fetcher/request-context";
import {
  parseSetCookies,
  shouldSaveApiCookies,
} from "@/lib/fetcher/set-cookie";

config({ quiet: true });

export const resolveApiOrigin = (): string => {
  // Through `CONFIG` rather than the variable directly, so the empty-value
  // throw stays in one place - see the `??` note there.
  if (process.env.NEXT_PUBLIC_API_URL !== undefined) return CONFIG.api.origin;

  try {
    return getRequestUrl().origin;
  } catch {
    return CONFIG.api.origin;
  }
};

export const getForwardedApiHeaders = ({
  captchaToken,
}: { captchaToken?: string } = {}): Record<string, string> => {
  const headers = getRequestHeaders();

  return buildForwardedHeaders({
    captchaToken,
    cookie: headers.get("cookie"),
    // The header first, verbatim, chain included: that is what the API stores,
    // and re-deriving it would log this server's hop as the visitor's IP. `getRequestIP()` is the fallback for a
    // directly-exposed server, where there is no proxy to have written one -
    // better than the `0.0.0.0` the header's absence would otherwise mean.
    forwardedFor: headers.get("x-forwarded-for") ?? getRequestIP(),
    userAgent: headers.get("user-agent"),
  });
};

export const saveApiCookies = (response: Response): void => {
  for (const { name, options, value } of parseSetCookies(
    response.headers.getSetCookie(),
  )) {
    setCookie(name, value, options);
  }
};

export const rawFetcher = async ({
  additionalHeaders,
  origin,
  ...args
}: RawApiFetchArgs): Promise<Response> =>
  await rawApiFetch({
    ...args,
    additionalHeaders: { ...getForwardedApiHeaders(), ...additionalHeaders },
    origin: origin ?? resolveApiOrigin(),
  });

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
    formData,
    additionalHeaders,
    allowSaveCookies = false,
    captchaToken,
    origin,
    prefixPath = "",
    withPagination = false,
  }: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> &
    FetcherRequestOptions & {
      allowSaveCookies?: boolean;
      captchaToken?: string;
    },
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  const response = await coreFetcher(moduleReturn, {
    path,
    method,
    module,
    args,
    options,
    formData,
    prefixPath,
    withPagination,
    additionalHeaders: {
      ...getForwardedApiHeaders({ captchaToken }),
      ...additionalHeaders,
    },
    // `NEXT_PUBLIC_API_URL` when a separate API server is configured, this
    // request's own origin otherwise - and an explicit `origin` on the call
    // overrides both.
    origin: origin ?? resolveApiOrigin(),
  } as FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> &
    FetcherRequestOptions);

  if (allowSaveCookies && shouldSaveApiCookies((response as Response).status)) {
    saveApiCookies(response);
  }

  return response;
}
