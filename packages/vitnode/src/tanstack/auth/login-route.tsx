"use client";

import type { QueryClient } from "@tanstack/react-query";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createTranslator } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SignInFormContent } from "@/views/auth/sign-in/form/sign-in-form-content";
import { SignInContent } from "@/views/auth/sign-in/sign-in-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import type { AuthNavigate } from "./actions";

import { intlQueryOptions } from "../i18n/query";
import { RouteMessages } from "../i18n/route-messages";
import { startSsoAction, useSignInAction } from "./actions";
import {
  middlewareConfigQueryOptions,
  ssoProvidersOf,
} from "./middleware-config";
import { postAuthDestination } from "./redirects";

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

export interface LoginRouteProps {
  LinkComponent: AuthLinkComponent;
  /**
   * How a finished sign-in moves. During the migration a host passes one that
   * asks its route tree whether it serves the destination, so `/discover` is a
   * client-side navigation and `/settings/security?tab=devices` is a document
   * load into the application that still serves it.
   */
  navigate: AuthNavigate;
  /** Where the visitor was heading before a guard sent them here. */
  returnTo?: string;
}

/**
 * The login page, as everything below a route file's `component`.
 *
 * This screen deliberately ignores `config.isKnown`: a failed read degrades to
 * no provider row and no reset-password link, and the email and password fields
 * - which are the whole of signing in on most installs - still render. Making
 * the login page unavailable because an optional read failed would be a far
 * larger outage than the one that caused it.
 */
export const LoginRouteContent = ({
  LinkComponent,
  navigate,
  returnTo,
}: LoginRouteProps) => {
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions());
  const signIn = useSignInAction({
    destination: () => postAuthDestination(returnTo),
    navigate,
  });

  return (
    <RouteMessages namespaces={LOGIN_NAMESPACES}>
      <main>
        <SignInContent
          form={
            <SignInFormContent
              LinkComponent={LinkComponent}
              onSignIn={signIn}
              showResetPassword={config.isEmail}
            />
          }
          LinkComponent={LinkComponent}
          sso={
            <SSOButtonsContent
              onSelectProvider={startSsoAction}
              providers={ssoProvidersOf(config)}
            />
          }
        />
      </main>
    </RouteMessages>
  );
};

export { loadAuthCard, translateAuthTitle };
