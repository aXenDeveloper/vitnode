import type { RequestServerOptions } from "@tanstack/react-start";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";

import { handleLocaleRequest } from "../i18n/request";
import {
  applyDocumentCacheControl,
  applyDocumentSecurityHeaders,
  applyRedirectCacheControl,
  DOCUMENT_SECURITY_HEADERS,
} from "./document-headers";

type LocaleRequestContext = Pick<
  RequestServerOptions<unknown, unknown>,
  "handlerType" | "next" | "request"
>;

export const runLocaleRequest = async (
  { handlerType, next, request }: LocaleRequestContext,
  localeRouting: LocaleRouting,
  securityHeaders: Record<string, string> = DOCUMENT_SECURITY_HEADERS,
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
  applyDocumentSecurityHeaders(result.response, securityHeaders);

  return result;
};
