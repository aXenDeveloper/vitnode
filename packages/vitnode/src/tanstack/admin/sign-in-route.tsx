"use client";

import { createTranslator } from "use-intl";

import { SignInAdminContent } from "@/views/admin/sign-in/sign-in-admin-content";
import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";

import type { AuthNavigate } from "../auth/actions";
import type { AdminLoaderContext } from "./intl";

import { intlQueryOptions } from "../i18n/query";
import { RouteMessages } from "../i18n/route-messages";
import { useAdminSignInAction } from "./actions";
import { sanitizeAdminReturnTo } from "./return-to";

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

export interface AdminSignInRouteProps {
  /**
   * How a finished sign-in moves. During the migration a host passes one that
   * asks its route tree whether it serves the destination, so `/admin/core`
   * is a document load into the Next.js AdminCP until that route lands here.
   */
  navigate: AuthNavigate;
  /** Where the administrator was heading before the guard sent them here. */
  returnTo?: string;
}

/**
 * The AdminCP sign-in page.
 *
 * The card, the logo and the form are shared with the Next.js screen; the action
 * is `useAdminSignInAction`, which signs in against the admin session and drops
 * the cached one before it navigates.
 *
 * `sanitizeAdminReturnTo` is applied *here*, where the value is used, rather
 * than in the route's `validateSearch`. The search contract keeps whatever
 * arrived and judges nothing - the same split `/login` uses - so there is one
 * place that decides whether a target is somewhere this app may send a browser,
 * and it is the place that hands it to a navigation.
 *
 * A thunk rather than a computed value, so the destination is read at submit
 * time: `?returnTo=` can change under a mounted form.
 */
export const AdminSignInRouteContent = ({
  navigate,
  returnTo,
}: AdminSignInRouteProps) => {
  const signIn = useAdminSignInAction({
    destination: () => sanitizeAdminReturnTo(returnTo),
    navigate,
  });

  return (
    <RouteMessages namespaces={ADMIN_SIGN_IN_NAMESPACES}>
      <main>
        <SignInAdminContent form={<SignInFormContent onSignIn={signIn} />} />
      </main>
    </RouteMessages>
  );
};
