"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { ChangePasswordFormContent } from "@/views/auth/password-reset/change-password-form/change-password-form-content";
import { PasswordResetFormContent } from "@/views/auth/password-reset/form/password-reset-form-content";
import { PasswordResetContent } from "@/views/auth/password-reset/password-reset-content";
import { ErrorContent } from "@/views/error/error-content";

import type { PasswordResetSearch } from "./recovery";

import { RouteMessages } from "../i18n/route-messages";
import {
  changePasswordFromResetAction,
  requestPasswordResetAction,
} from "./actions";
import { middlewareConfigQueryOptions } from "./middleware-config";
import { passwordResetMode } from "./recovery";
import { LOGIN_PATH, parseInternalDestination } from "./redirects";

/**
 * Where the visitor goes once the password has changed.
 *
 * The login page, replacing the current entry rather than pushing one - which is
 * what the Next.js form does (`replace("/login")`) and worth keeping for a
 * reason beyond parity: the URL being left behind carries a recovery token, and
 * a push would leave it one Back press away.
 *
 * The API mints **no session** on a password change, so this really is the next
 * step rather than a redundant hop: the visitor is still signed out.
 *
 * `parseInternalDestination` rather than a bare `to`, so the navigation goes
 * through `buildLocation` and the locale rewrite writes the prefix back - a
 * Polish visitor lands on `/pl/login`.
 */
const CHANGED_PASSWORD_DESTINATION = {
  ...parseInternalDestination(LOGIN_PATH),
  replace: true,
};

export const PasswordRecoveryNotFound = ({
  actions,
}: {
  actions: React.ReactNode;
}) => {
  const t = useTranslations("core.global");

  return (
    <main>
      <ErrorContent
        actions={actions}
        code={404}
        description={t("errors.404.desc")}
        title={t("errors.404.title")}
      />
    </main>
  );
};

export interface PasswordResetRouteProps {
  namespaces: readonly string[];
  search: PasswordResetSearch;
}

/**
 * Password recovery, as everything below a route file's `component` - both
 * halves of it.
 *
 *     /login/reset-password                       ask for a link
 *     /login/reset-password?token=..&userId=..    choose a new password
 *
 * which is what the Next.js `PasswordResetView` does with `if (token && userId)`.
 * The mode is decided from the same pure function the loader used, so the
 * namespaces mounted are the ones warmed for it, and the change-password branch
 * carries the *parsed* link - which is what makes it impossible to render that
 * form without both halves of a well-formed one.
 */
export const PasswordResetRouteContent = ({
  namespaces,
  search,
}: PasswordResetRouteProps) => {
  const router = useRouter();
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions());
  const mode = passwordResetMode(search);

  return (
    <RouteMessages namespaces={namespaces}>
      <main>
        <PasswordResetContent>
          {mode.mode === "change" ? (
            <ChangePasswordFormContent
              link={mode.link}
              onChanged={() => {
                void router.navigate(CHANGED_PASSWORD_DESTINATION);
              }}
              onChangePassword={changePasswordFromResetAction}
            />
          ) : (
            /*
              No `onSuccess` and no navigation: an accepted request swaps the
              card for "check your email" and leaves the visitor there. It says
              the same thing for an address with an account and one without,
              because the API answers the same 201 for both - the
              anti-enumeration behaviour is preserved by there being nothing
              here that could distinguish them.
            */
            <PasswordResetFormContent
              captcha={config.captcha}
              onRequestReset={requestPasswordResetAction}
            />
          )}
        </PasswordResetContent>
      </main>
    </RouteMessages>
  );
};
