import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import { intlQueryOptions } from "../i18n/query";
import { middlewareConfigQueryOptions } from "./middleware-config";

export const LOGIN_NAMESPACES = [
  "core.global",
  "core.auth.sign_in",
  "core.auth.sso",
] as const;

/** The narrowest slice of a route's context these loaders read. */
export interface AuthLoaderContext {
  locale: string;
  queryClient: QueryClient;
}

/** What an auth route's loader returns, and therefore what `head` receives. */
export interface AuthRouteData {
  title: string;
}

const translateAuthTitle = (
  locale: string,
  messages: unknown,
  key: "login" | "register",
): string =>
  createTranslator({
    locale,
    messages: messages as {
      core: { global: { login: string; register: string } };
    },
    namespace: "core.global",
  })(key);

const loadAuthCard = async (
  { locale, queryClient }: AuthLoaderContext,
  namespaces: readonly string[],
  key: "login" | "register",
): Promise<AuthRouteData> => {
  const [intl] = await Promise.all([
    queryClient.ensureQueryData(intlQueryOptions({ locale, namespaces })),
    queryClient.ensureQueryData(middlewareConfigQueryOptions()),
  ]);

  return { title: translateAuthTitle(locale, intl.messages, key) };
};

/** {@link loadAuthCard} for `/login`. */
export const loadLoginRoute = async (
  context: AuthLoaderContext,
): Promise<AuthRouteData> =>
  await loadAuthCard(context, LOGIN_NAMESPACES, "login");

export { loadAuthCard, translateAuthTitle };
