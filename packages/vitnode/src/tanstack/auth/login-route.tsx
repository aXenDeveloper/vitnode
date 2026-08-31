import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import { intlQueryOptions } from "../i18n/query";
import { middlewareConfigQueryOptions } from "./middleware-config";

/**
 * What the login page renders strings from.
 *
 * `core.global` is the shell's and the heading's, `core.auth.sign_in` is the
 * card's and the form's, `core.auth.sso` is the provider row's. One list, read
 * by both the loader that fetches them and the provider that mounts them,
 * because they have to be the same set or the provider suspends on a key nobody
 * warmed.
 */
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

/**
 * One of the auth pages' titles, translated once in the request's language.
 *
 * The cast is what makes `createTranslator` usable at all: its key type is
 * derived from the *inferred* type of `messages`, and `AbstractIntlMessages` is
 * a bare index signature - so `MessageKeys` cannot tell a leaf from a branch and
 * collapses to `never`, making every key a type error. Naming the two keys the
 * auth routes read is both the smallest fix and a true statement: rename either
 * in `locales/en.json` and this stops compiling instead of rendering a raw
 * message key into a `<title>`.
 */
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

/**
 * The two reads an auth card needs, in parallel and before it renders.
 *
 * Neither is repeated by the component: the messages are read back by
 * `RouteMessages` through the identical `intlQueryOptions`, and the deployment
 * configuration by `useSuspenseQuery` through the identical
 * `middlewareConfigQueryOptions` - the same entry both cards warm, so arriving
 * from one to the other costs nothing.
 *
 * The session is *not* fetched here. A guest guard's `beforeLoad` has already
 * put it in the cache entry every guard reads.
 */
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
