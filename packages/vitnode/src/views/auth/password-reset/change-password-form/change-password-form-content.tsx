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
