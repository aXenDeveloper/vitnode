import type { LocaleRouting } from "@vitnode/api/lib/i18n/locale-routing";

import { createMiddleware } from "@tanstack/react-start";

import { runLocaleRequest } from "./locale-request";

export const createLocaleRequestMiddleware = (
  localeRouting: LocaleRouting,
  securityHeaders?: Record<string, string>,
) =>
  createMiddleware().server(
    async ctx => await runLocaleRequest(ctx, localeRouting, securityHeaders),
  );
