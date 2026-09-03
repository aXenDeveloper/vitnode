import { createMiddleware } from "@tanstack/react-start";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";

import { runLocaleRequest } from "./locale-request";

export const createLocaleRequestMiddleware = (localeRouting: LocaleRouting) =>
  createMiddleware().server(
    async ctx => await runLocaleRequest(ctx, localeRouting),
  );
