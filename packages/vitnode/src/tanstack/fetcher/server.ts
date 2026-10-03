import "@tanstack/react-start/server-only";
import {
  getRequestHeaders,
  getRequestIP,
  getRequestUrl,
  setCookie,
} from "@tanstack/react-start/server";
import { config } from "dotenv";

import type { RawApiFetchArgs } from "@/lib/fetcher/raw";
import type {
  FetcherCall,
  FetcherRequestOptions,
  RegisteredPluginId,
  ResponseFor,
} from "@/lib/fetcher/types";

import { CONFIG } from "@/lib/config";
import { coreFetcher } from "@/lib/fetcher/core";
import {
  FORWARDED_SIGNATURE_HEADER,
  resolveForwardedIpSecret,
  signForwardedFor,
} from "@/lib/fetcher/forwarded-signature.server";
import { rawApiFetch } from "@/lib/fetcher/raw";
import {
  buildForwardedHeaders,
  resolveVisitorIp,
} from "@/lib/fetcher/request-context";
import {
  parseSetCookies,
  shouldSaveApiCookies,
} from "@/lib/fetcher/set-cookie";

config({ quiet: true });

export const resolveApiOrigin = (): string => {
  // Through `CONFIG` rather than the variable directly, so the empty-value
  // throw stays in one place - see the `??` note there.
  if (process.env.VITNODE_API_URL !== undefined) return CONFIG.api.origin;

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
  const forwarded = buildForwardedHeaders({
    captchaToken,
    cookie: headers.get("cookie"),
    forwardedFor: resolveVisitorIp({
      forwardedFor: headers.get("x-forwarded-for"),
      socketAddress: getRequestIP(),
      trustedProxyHops: CONFIG.trustedProxyHops,
    }),
    userAgent: headers.get("user-agent"),
  });
  const secret = resolveForwardedIpSecret();
  if (!secret) return forwarded;

  return {
    ...forwarded,
    [FORWARDED_SIGNATURE_HEADER]: signForwardedFor({
      forwardedFor: forwarded["x-forwarded-for"],
      secret,
    }),
  };
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

export type FetcherServerOptions = FetcherRequestOptions & {
  allowSaveCookies?: boolean;
  captchaToken?: string;
};

export async function fetcher<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
>({
  additionalHeaders,
  allowSaveCookies = false,
  args,
  captchaToken,
  formData,
  method,
  module,
  options,
  origin,
  path,
  plugin,
  withPagination = false,
}: FetcherCall<P, M, Path, Method, FetcherServerOptions>): Promise<
  ResponseFor<P, M, Path, Method>
> {
  const response = await coreFetcher<P, M, Path, Method>({
    args,
    formData,
    method,
    module,
    options,
    path,
    plugin,
    withPagination,
    additionalHeaders: {
      ...getForwardedApiHeaders({ captchaToken }),
      ...additionalHeaders,
    },
    // `VITNODE_API_URL` when a separate API server is configured, this
    // request's own origin otherwise - and an explicit `origin` on the call
    // overrides both.
    origin: origin ?? resolveApiOrigin(),
  } as FetcherCall<P, M, Path, Method, FetcherRequestOptions>);

  if (allowSaveCookies && shouldSaveApiCookies((response as Response).status)) {
    saveApiCookies(response);
  }

  return response;
}
