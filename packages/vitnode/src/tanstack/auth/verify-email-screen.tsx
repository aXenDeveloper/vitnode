import { useTranslations } from "use-intl";

import { ConfirmEmailContent } from "@/views/auth/verify-email/confirm-email-content";
import { ResendVerificationFormContent } from "@/views/auth/verify-email/resend-verification-form-content";
import { VerifyEmailContent } from "@/views/auth/verify-email/verify-email-content";

import type { VerifyEmailSearch } from "./verify-email";

import { RouteMessages } from "../i18n/route-messages";
import { confirmEmailAction, resendEmailVerificationAction } from "./actions";
import { useMiddlewareConfigQuery } from "./middleware-config";
import { VERIFY_EMAIL_NAMESPACES, verifyEmailMode } from "./verify-email";

export interface VerifyEmailRouteProps {
  search: VerifyEmailSearch;
}

export const VerifyEmailRouteContent = ({ search }: VerifyEmailRouteProps) => {
  const { data: config } = useMiddlewareConfigQuery();
  const mode = verifyEmailMode(search);

  return (
    <RouteMessages namespaces={VERIFY_EMAIL_NAMESPACES}>
      <VerifyEmailContent>
        {mode.mode === "confirm" ? (
          <ConfirmEmailContent
            key={mode.token}
            onConfirm={confirmEmailAction(mode.token)}
          />
        ) : (
          <ResendVerificationFormContent
            captcha={config.captcha}
            onResend={resendEmailVerificationAction}
          />
        )}
      </VerifyEmailContent>
    </RouteMessages>
  );
};

export const VerifyEmailBreadcrumb = () => {
  const t = useTranslations("core.auth.verify_email");

  return <>{t("title")}</>;
};
