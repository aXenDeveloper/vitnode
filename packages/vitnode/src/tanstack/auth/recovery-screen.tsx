import { useRouter } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { ChangePasswordFormContent } from "@/views/auth/password-reset/change-password-form/change-password-form-content";
import { PasswordResetContent } from "@/views/auth/password-reset/password-reset-content";
import { ErrorContent } from "@/views/error/error-content";

import type { PasswordResetSearch } from "./recovery";

import { RouteMessages } from "../i18n/route-messages";
import { changePasswordFromResetAction } from "./actions";
import { passwordResetMode } from "./recovery";
import { LOGIN_PATH, parseInternalDestination } from "./redirects";

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
    <ErrorContent
      actions={actions}
      code={404}
      description={t("errors.404.desc")}
      title={t("errors.404.title")}
    />
  );
};

export interface PasswordResetRouteProps {
  namespaces: readonly string[];
  search: PasswordResetSearch;
}

export const PasswordResetRouteContent = ({
  namespaces,
  search,
}: PasswordResetRouteProps) => {
  const router = useRouter();
  const mode = passwordResetMode(search);

  return (
    <RouteMessages namespaces={namespaces}>
      <PasswordResetContent>
        {mode.mode === "change" ? (
          <ChangePasswordFormContent
            link={mode.link}
            onChanged={() => {
              void router.navigate(CHANGED_PASSWORD_DESTINATION);
            }}
            onChangePassword={changePasswordFromResetAction}
          />
        ) : null}
      </PasswordResetContent>
    </RouteMessages>
  );
};
