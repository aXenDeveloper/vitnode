"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SignUpFormContent } from "@/views/auth/sign-up/form/sign-up-form-content";
import { SignUpContent } from "@/views/auth/sign-up/sign-up-content";
import { SSOButtonsContent } from "@/views/auth/sso/buttons/sso-buttons-content";

import type { AuthNavigate } from "./actions";
import type { AuthLoaderContext, AuthRouteData } from "./login-route";

import { RouteMessages } from "../i18n/route-messages";
import { startSsoAction, useSignUpAction } from "./actions";
import { loadAuthCard } from "./login-route";
import {
  middlewareConfigQueryOptions,
  ssoProvidersOf,
} from "./middleware-config";
import { postAuthDestination } from "./redirects";

/**
 * What the registration page renders strings from.
 *
 * `core.global` is the heading's and the error toasts', `core.auth.sign_up` is
 * the form's, `core.auth.sso` is the provider row's - the same three the Next.js
 * view declares. One list, read by both the loader that fetches them and the
 * provider that mounts them, because they have to be the same set or the
 * provider suspends on a key nobody warmed.
 */
export const REGISTER_NAMESPACES = [
  "core.global",
  "core.auth.sign_up",
  "core.auth.sso",
] as const;

/** The strings and the deployment configuration `/register` needs. */
export const loadRegisterRoute = async (
  context: AuthLoaderContext,
): Promise<AuthRouteData> =>
  await loadAuthCard(context, REGISTER_NAMESPACES, "register");

export interface RegisterRouteProps {
  LinkComponent: AuthLinkComponent;
  navigate: AuthNavigate;
}

/**
 * The registration page, as everything below a route file's `component`.
 *
 * ## A deliberate decision not to branch on whether the config was read
 *
 * `config.isKnown` is available here - the same certainty flag password recovery
 * acts on - and registration keeps its degraded rendering anyway: on an outage
 * the card still shows the fields, minus the captcha widget and the provider
 * row. That is a real cost on a captcha-configured deployment, where the submit
 * then carries an empty token and the API answers `400`, which the form raises
 * as the internal-error toast. Degraded, but never wrong: nothing is created and
 * nothing is claimed to have been.
 *
 * It stays that way because the alternative is worse for the same visitor. A
 * hard error would take registration down for every deployment - captcha or not
 * - because one optional read failed, and most VitNode installs configure no
 * captcha at all, so their signup would work perfectly if only it rendered.
 * Password recovery is different in kind rather than in degree: there the
 * fallback does not degrade a screen, it *asserts a fact* - "this deployment
 * sends no email" - and turns that into a 404.
 *
 * ## The two kinds of success
 *
 * On a deployment with no email adapter the API marks the account verified and
 * mints a session on the same response, so the cookie is copied onto this
 * response, the canonical session entry is invalidated, and only then does the
 * router move - a navigation that ran first would arrive at a guard still
 * holding the anonymous session.
 *
 * On a deployment *with* an email adapter the account is unverified and no
 * session exists, so the action navigates nowhere and answers
 * `{ emailConfirmation }`; the shared form hands that to `WrapperSignUp` and the
 * card is replaced by the "check your email" screen. Nothing here pretends the
 * visitor is signed in.
 *
 * The destination is a thunk because `useSignUpAction` takes one - there is no
 * `returnTo` on this route to read late, so it is a constant, and it is the same
 * `postAuthDestination(undefined)` a guest guard sends a signed-in visitor to.
 */
export const RegisterRouteContent = ({
  LinkComponent,
  navigate,
}: RegisterRouteProps) => {
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions());
  const signUp = useSignUpAction({
    destination: () => postAuthDestination(undefined),
    navigate,
  });

  return (
    <RouteMessages namespaces={REGISTER_NAMESPACES}>
      <main>
        <SignUpContent
          form={
            <SignUpFormContent
              captcha={config.captcha}
              isEmail={config.isEmail}
              LinkComponent={LinkComponent}
              onSignUp={signUp}
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
