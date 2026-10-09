import type { AnyRequestMiddleware } from "@tanstack/react-start";

import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import type { LocaleConfig } from "@/lib/i18n/types";
import type { VitNodeConfig } from "@/vitnode.config";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";

import type { DocumentSecurityHeaders } from "./document-headers";

import { resolveDocumentSecurityHeaders } from "./document-headers";
import { createLocaleRequestMiddleware } from "./locale-middleware";

export interface VitNodeStartOptions<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  config: VitNodeConfig<AppLocales>;

  requestMiddleware?: readonly AnyRequestMiddleware[];
  securityHeaders?: DocumentSecurityHeaders;
}

export const createVitNodeStart = <AppLocales extends LocaleConfig[]>({
  config,
  requestMiddleware = [],
  securityHeaders,
}: VitNodeStartOptions<AppLocales>) => {
  const localeRouting = localeRoutingFromConfig(config.i18n);
  const documentHeaders = resolveDocumentSecurityHeaders(securityHeaders);

  return createStart(() => ({
    requestMiddleware: [
      createCsrfMiddleware({ filter: ctx => ctx.handlerType === "serverFn" }),
      createLocaleRequestMiddleware(localeRouting, documentHeaders),
      ...requestMiddleware,
    ],
  }));
};
