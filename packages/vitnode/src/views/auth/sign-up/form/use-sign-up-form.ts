"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import type {
  SignUpFormSchema,
  SignUpFormValues,
  SignUpMutationResult,
  SignUpSubmitValues,
} from "./schema";

import { useWrapperSignUp } from "../wrapper";
import { createSignUpFormSchema, signUpFormOutcome } from "./schema";

export type { SignUpSubmitValues };

export type SignUpSubmit = (
  values: SignUpSubmitValues,
) => Promise<SignUpMutationResult>;

export const useSignUpForm = ({ onSignUp }: { onSignUp: SignUpSubmit }) => {
  const t = useTranslations("core.auth.sign_up");
  const tErrors = useTranslations("core.global.errors");
  const { setSendingEmail } = useWrapperSignUp();

  const formSchema = createSignUpFormSchema({
    fieldRequired: tErrors("field_required"),
    invalidEmail: t("email.invalid"),
    invalidPassword: t("password.invalid"),
    nameMaxLength: t("username.max_length"),
    nameMinLength: t("username.min_length"),
    termsRequired: t("terms.required"),
  });

  const onSubmit: AutoFormOnSubmit<SignUpFormSchema> = async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { terms: _terms, ...values }: SignUpFormValues,
    form,
    { captchaToken },
  ) => {
    const outcome = signUpFormOutcome(
      await onSignUp({ ...values, captchaToken }),
    );

    if (!outcome) return;

    if (outcome.kind === "confirmation") {
      setSendingEmail(outcome.email);

      return;
    }

    if (outcome.kind === "field") {
      form.setError(
        outcome.field,
        {
          type: "manual",
          message:
            outcome.field === "email"
              ? t("email.exists")
              : t("username.exists"),
        },
        { shouldFocus: true },
      );

      return;
    }

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  return { formSchema, onSubmit };
};
