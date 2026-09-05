import { createTranslator } from "use-intl";

import type { AdminLoaderContext } from "./intl";

import { intlQueryOptions } from "../i18n/query";

export const ADMIN_SIGN_IN_NAMESPACES = [
  "core.global",
  "core.auth.sign_in",
] as const;

/** What the sign-in route's loader returns, and therefore what `head` receives. */
export interface AdminSignInRouteData {
  title: string;
}

const translateAdminSignInTitle = (locale: string, messages: unknown): string =>
  createTranslator({
    locale,
    messages: messages as { core: { global: { login: string } } },
    namespace: "core.global",
  })("login");

export const loadAdminSignInRoute = async ({
  locale,
  queryClient,
}: AdminLoaderContext): Promise<AdminSignInRouteData> => {
  const intl = await queryClient.ensureQueryData(
    intlQueryOptions({ locale, namespaces: ADMIN_SIGN_IN_NAMESPACES }),
  );

  return { title: translateAdminSignInTitle(locale, intl.messages) };
};
