import { createTranslator } from "use-intl";

import type { AdminLoaderContext } from "./intl";

import { intlQueryOptions } from "../i18n/query";

/**
 * `/admin` - the AdminCP sign-in screen, as everything below a route file's
 * `component`.
 *
 * A page, not a shell. It sits *outside* `_admin`, because `_admin` is the
 * admin-session guard and putting a guard in front of the page that exists to
 * create a session is a closed loop. Same shape as `/login` against
 * `_authenticated`, for the same reason.
 */

/**
 * What this screen renders strings from.
 *
 * `core.global` for the design-system copy and the form's error toast,
 * `core.auth.sign_in` for the fields and the access-denied alert. It is the same
 * pair the Next.js `SignInAdminView` asks for - `<I18nProvider
 * namespaces={["core.auth.sign_in"]}>` plus the `core.global` that provider
 * always prepends - so the screen's strings survive the migration unchanged.
 *
 * Deliberately *not* `admin.global`. The sign-in screen renders no shell: no
 * sidebar, no search, no user bar. Warming the shell's namespace here would ship
 * an administrator's whole navigation vocabulary to a page that has none.
 */
export const ADMIN_SIGN_IN_NAMESPACES = [
  "core.global",
  "core.auth.sign_in",
] as const;

/** What the sign-in route's loader returns, and therefore what `head` receives. */
export interface AdminSignInRouteData {
  title: string;
}

/**
 * The page title, translated once in the request's language.
 *
 * The cast is what makes `createTranslator` usable at all: its key type is
 * derived from the *inferred* type of `messages`, and `AbstractIntlMessages` is
 * a bare index signature - so `MessageKeys` collapses to `never` and every key
 * is a type error. Naming the one key this route reads is both the smallest fix
 * and a true statement: rename `login` in `locales/en.json` and this stops
 * compiling instead of rendering a raw message key into a `<title>`.
 */
const translateAdminSignInTitle = (locale: string, messages: unknown): string =>
  createTranslator({
    locale,
    messages: messages as { core: { global: { login: string } } },
    namespace: "core.global",
  })("login");

/**
 * The one read this screen needs, before it renders.
 *
 * Not repeated by the component: `RouteMessages` reads the messages back through
 * the identical `intlQueryOptions`, so the entry the loader filled is the entry
 * the provider mounts.
 *
 * The admin session is deliberately *not* fetched here. The route's `beforeLoad`
 * has already looked - tolerantly, through `prefetchAdminAccess`, so a failed
 * read leaves the form on screen rather than replacing the AdminCP's only
 * entrance with an error page.
 */
export const loadAdminSignInRoute = async ({
  locale,
  queryClient,
}: AdminLoaderContext): Promise<AdminSignInRouteData> => {
  const intl = await queryClient.ensureQueryData(
    intlQueryOptions({ locale, namespaces: ADMIN_SIGN_IN_NAMESPACES }),
  );

  return { title: translateAdminSignInTitle(locale, intl.messages) };
};
