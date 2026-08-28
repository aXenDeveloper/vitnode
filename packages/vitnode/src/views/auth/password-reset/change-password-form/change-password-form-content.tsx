"use client";

import { useTranslations } from "use-intl";

import { AutoForm } from "@/components/form/auto-form";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { RecoveryLink } from "../recovery-link";

import { PasswordInput } from "../../sign-up/components/password-input";
import {
  type ChangePasswordSubmit,
  useChangePasswordForm,
} from "./use-change-password-form";

export type { ChangePasswordSubmit };

/**
 * The second half of password recovery - shared.
 *
 * One field, and two props that are the framework boundary: the mutation, and
 * what to do once the password has changed. The form no longer imports a server
 * action or `@/lib/navigation`, so a TanStack Start route renders exactly the
 * card the Next.js page renders.
 *
 * `link` is already parsed - see `../recovery-link.ts`. A route that could not
 * parse one must render the request form instead, which is a decision for the
 * page rather than for this component: there is no such thing as this screen
 * without a link.
 *
 * No captcha: the API's change-password route does not ask for one
 * (`withCaptcha` is absent), because the token in the link is the thing being
 * checked.
 */
export const ChangePasswordFormContent = ({
  link,
  onChanged,
  onChangePassword,
}: {
  link: RecoveryLink;
  onChanged: () => void;
  onChangePassword: ChangePasswordSubmit;
}) => {
  const t = useTranslations("core.auth.change_password");
  const tSignUp = useTranslations("core.auth.sign_up");
  const { formSchema, onSubmit } = useChangePasswordForm({
    link,
    onChanged,
    onChangePassword,
  });

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle>
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription>{t("desc")}</CardDescription>
      </CardHeader>

      <CardContent>
        <AutoForm
          fields={[
            {
              id: "password",
              component: props => (
                <PasswordInput label={tSignUp("password.label")} {...props} />
              ),
            },
          ]}
          formSchema={formSchema}
          onSubmit={onSubmit}
          submitButtonProps={{
            className: "w-full",
            children: t("submit"),
          }}
        />
      </CardContent>
    </>
  );
};
