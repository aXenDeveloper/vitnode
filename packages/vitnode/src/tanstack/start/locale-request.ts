import type { RequestServerOptions } from "@tanstack/react-start";
import type { LocaleRouting } from "@vitnode/api/lib/i18n/locale-routing";

import {
  isPageCacheRenderMarker,
  PAGE_CACHE_RENDER_HEADER,
} from "@vitnode/api/page-cache/tags";

import { requestHostOf } from "../i18n/host";
import { handleLocaleRequest } from "../i18n/request";
import {
  applyDocumentCacheControl,
  applyDocumentSecurityHeaders,
  applyRedirectCacheControl,
  DOCUMENT_SECURITY_HEADERS,
  isFrameDeniedPath,
  withFramingDenied,
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

  const { pathname } = localeRouting.deLocalizeUrl(new URL(request.url), {
    host: requestHostOf(request),
  });
  const documentHeaders = isFrameDeniedPath(pathname)
    ? withFramingDenied(securityHeaders)
    : securityHeaders;

  const result = await next();

  // A shared render is stored and served to everybody, so the visitor's own
  // locale cookie and the no-store default are the page cache's to apply -
  // once it knows whether this response may be shared at all.
  if (isPageCacheRenderMarker(request.headers.get(PAGE_CACHE_RENDER_HEADER))) {
    applyDocumentSecurityHeaders(result.response, documentHeaders);

    return result;
  }

  if (setCookie) result.response.headers.append("set-cookie", setCookie);
  applyDocumentCacheControl(result.response);
  applyDocumentSecurityHeaders(result.response, documentHeaders);

  return result;
};
