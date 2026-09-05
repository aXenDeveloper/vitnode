"use client";

import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import type {
  PasswordResetFormSchema,
  PasswordResetMutationResult,
  PasswordResetSubmitValues,
} from "./schema";

import {
  createPasswordResetFormSchema,
  passwordResetFormOutcome,
} from "./schema";

export type { PasswordResetSubmitValues };

export type PasswordResetSubmit = (
  values: PasswordResetSubmitValues,
) => Promise<PasswordResetMutationResult>;

export const usePasswordResetForm = ({
  onRequestReset,
}: {
  onRequestReset: PasswordResetSubmit;
}) => {
  const t = useTranslations("core.auth.sign_up");
  const tErrors = useTranslations("core.global.errors");
  const [sentEmail, setSentEmail] = React.useState("");

  const formSchema = createPasswordResetFormSchema({
    invalidEmail: t("email.invalid"),
  });

  const onSubmit: AutoFormOnSubmit<PasswordResetFormSchema> = async (
    { email },
    _form,
    { captchaToken },
  ) => {
    const outcome = passwordResetFormOutcome(
      await onRequestReset({ captchaToken, email }),
    );

    if (outcome.kind === "toast") {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });

      return;
    }

    setSentEmail(email);
  };

  return { formSchema, onSubmit, sentEmail };
};
