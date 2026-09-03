"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import type { RecoveryLink } from "../recovery-link";
import type {
  ChangePasswordFormSchema,
  ChangePasswordMutationResult,
  ChangePasswordSubmitValues,
} from "./schema";

import {
  changePasswordFormOutcome,
  createChangePasswordFormSchema,
} from "./schema";

export type { ChangePasswordSubmitValues };

export type ChangePasswordSubmit = (
  values: ChangePasswordSubmitValues,
) => Promise<ChangePasswordMutationResult>;

export const useChangePasswordForm = ({
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
  const tErrors = useTranslations("core.global.errors");

  const formSchema = createChangePasswordFormSchema({
    fieldRequired: tErrors("field_required"),
    invalidPassword: tSignUp("password.invalid"),
  });

  const onSubmit: AutoFormOnSubmit<ChangePasswordFormSchema> = async ({
    password,
  }) => {
    const outcome = changePasswordFormOutcome(
      await onChangePassword({ ...link, password }),
    );

    if (outcome.kind === "toast") {
      toast.error(
        outcome.reason === "invalid_token"
          ? tErrors("400.title")
          : tErrors("title"),
        {
          description:
            outcome.reason === "invalid_token"
              ? tErrors("400.desc")
              : tErrors("internal_server_error"),
        },
      );

      return;
    }

    toast.success(t("success.title"), { description: t("success.desc") });
    onChanged();
  };

  return { formSchema, onSubmit };
};
