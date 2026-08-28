import React from "react";

import { getMiddlewareApi } from "@/lib/api/get-middleware-api";

import { I18nProvider } from "../../../components/i18n-provider";
import { SSOButtons, SSOButtonsSkeleton } from "../sso/buttons/sso-buttons";
import { FormSignUp } from "./form/form";
import { SignUpFormSkeleton } from "./form/sign-up-form-content";
import { SignUpCard } from "./sign-up-card";

const SignUpForm = async () => {
  const { captcha, isEmail } = await getMiddlewareApi();

  return <FormSignUp captcha={captcha} isEmail={isEmail} />;
};

/**
 * The registration page for Next.js.
 *
 * Everything visible is `SignUpContent`, shared with TanStack Start. What stays
 * here is the half that is genuinely Next.js: the request-scoped message
 * provider, and the two Server Components that read the deployment
 * configuration - which adapters are registered, whether an email adapter
 * exists, and the public captcha key. Both sit inside their own `<Suspense>`
 * because `getMiddlewareApi` waits for a real request (see its own note), so the
 * card paints immediately and each part fills in when its data lands.
 */
export const SignUpView = () => (
  <I18nProvider namespaces={["core.auth.sign_up", "core.auth.sso"]}>
    <SignUpCard
      form={
        <React.Suspense fallback={<SignUpFormSkeleton />}>
          <SignUpForm />
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
