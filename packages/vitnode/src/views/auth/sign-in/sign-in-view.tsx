import React from "react";

import { getMiddlewareApi } from "@/lib/api/get-middleware-api";

import { I18nProvider } from "../../../components/i18n-provider";
import { SSOButtons, SSOButtonsSkeleton } from "../sso/buttons/sso-buttons";
import { FormSignIn } from "./form/form";
import { SignInFormSkeleton } from "./form/sign-in-form-content";
import { SignInCard } from "./sign-in-card";

const SignInForm = async () => {
  const { isEmail } = await getMiddlewareApi();

  return <FormSignIn isEmail={isEmail} />;
};

/**
 * The login page for Next.js.
 *
 * Everything visible is `SignInContent`, shared with TanStack Start. What stays
 * here is the half that is genuinely Next.js: the request-scoped message
 * provider, and the two Server Components that read the deployment
 * configuration - which adapters are registered, and whether an email adapter
 * exists to send a reset link. Both sit inside their own `<Suspense>` because
 * `getMiddlewareApi` waits for a real request (see its own note), so the card
 * paints immediately and each part fills in when its data lands.
 */
export const SignInView = () => (
  <I18nProvider namespaces={["core.auth.sign_in", "core.auth.sso"]}>
    <SignInCard
      form={
        <React.Suspense fallback={<SignInFormSkeleton />}>
          <SignInForm />
        </React.Suspense>
      }
      sso={
        <React.Suspense fallback={<SSOButtonsSkeleton />}>
          <SSOButtons />
        </React.Suspense>
      }
    />
  </I18nProvider>
);
