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

/**
 * How the form asks for a reset link.
 *
 * The whole of the framework boundary for password recovery's first half: an
 * address and a captcha token in, "it was accepted" or "it failed" out. Next.js
 * calls a server action; TanStack Start calls a server function. Neither is
 * imported here.
 */
export type PasswordResetSubmit = (
  values: PasswordResetSubmitValues,
) => Promise<PasswordResetMutationResult>;

/**
 * The reset-request form's behaviour, with no idea which framework is rendering
 * it.
 *
 * `sentEmail` is the whole of its state, and it is local on purpose: the
 * confirmation screen prints the address the visitor typed, which this side
 * already has, so nothing needs to come back from the server for it. Which is
 * also what makes the screen say the same thing for an address that exists and
 * one that does not.
 */
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
