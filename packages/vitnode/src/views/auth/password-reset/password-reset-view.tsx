import type z from "zod";

import { notFound } from "next/navigation";
import React from "react";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import { I18nProvider } from "@/components/i18n-provider";
import { getMiddlewareApi } from "@/lib/api/get-middleware-api";

import { ChangePasswordForm } from "./change-password-form/form";
import { PasswordResetForm } from "./form/form";
import {
  PasswordResetContent,
  PasswordResetSkeleton,
} from "./password-reset-content";
import { parseRecoveryLink } from "./recovery-link";

type Captcha = z.infer<typeof routeMiddlewareSchema>["captcha"];

/**
 * Which of the two recovery screens this URL asks for.
 *
 * `parseRecoveryLink` rather than `if (token && userId)`: the query comes out of
 * an email and anyone can craft one, so a `?token=%20&userId=0` must render the
 * request form rather than a change-password form that can only fail. The rule
 * is shared with the TanStack Start route, which reads the same parameters
 * through its own search schema.
 */
const PasswordResetRouteContent = async ({
  captcha,
  searchParams,
}: {
  captcha: Captcha;
  searchParams: Promise<{ token?: string; userId?: string }>;
}) => {
  const link = parseRecoveryLink(await searchParams);

  if (link) {
    return (
      <I18nProvider
        namespaces={["core.auth.sign_up", "core.auth.change_password"]}
      >
        <ChangePasswordForm link={link} />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider
      namespaces={["core.auth.sign_up", "core.auth.reset_password"]}
    >
      <PasswordResetForm captcha={captcha} />
    </I18nProvider>
  );
};

export const PasswordResetView = async ({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; userId?: string }>;
}) => {
  const { captcha, isEmail } = await getMiddlewareApi();
  if (!isEmail) notFound();

  return (
    <PasswordResetContent>
      <React.Suspense fallback={<PasswordResetSkeleton />}>
        <PasswordResetRouteContent
          captcha={captcha}
          searchParams={searchParams}
        />
      </React.Suspense>
    </PasswordResetContent>
  );
};
