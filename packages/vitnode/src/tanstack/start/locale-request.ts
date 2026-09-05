import type { RequestServerOptions } from "@tanstack/react-start";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";

import { handleLocaleRequest } from "../i18n/request";
import {
  applyDocumentCacheControl,
  applyRedirectCacheControl,
} from "./document-headers";

type LocaleRequestContext = Pick<
  RequestServerOptions<unknown, unknown>,
  "handlerType" | "next" | "request"
>;

export const runLocaleRequest = async (
  { handlerType, next, request }: LocaleRequestContext,
  localeRouting: LocaleRouting,
) => {
  if (handlerType !== "router") return await next();

  const { redirect, setCookie } = handleLocaleRequest(request, localeRouting);
  if (redirect) {
    applyRedirectCacheControl(redirect);

    return redirect;
  }

  const result = await next();
  if (setCookie) result.response.headers.append("set-cookie", setCookie);
  applyDocumentCacheControl(result.response);

  return result;
};
