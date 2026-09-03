"use client";

import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import type {
  SignInFormError,
  SignInFormSchema,
  SignInFormValues,
  SignInMutationResult,
} from "./schema";

import { createSignInFormSchema, signInFormOutcome } from "./schema";

export type SignInSubmit = (
  values: SignInFormValues,
) => Promise<SignInMutationResult>;

export const useSignInForm = ({ onSignIn }: { onSignIn: SignInSubmit }) => {
  const [error, setError] = React.useState<SignInFormError>("");
  const t = useTranslations("core.auth.sign_in");
  const tErrors = useTranslations("core.global.errors");
  const formSchema = createSignInFormSchema({
    invalidEmail: t("email.invalid"),
    passwordRequired: t("password.required"),
  });

  const onSubmit: AutoFormOnSubmit<SignInFormSchema> = async values => {
    setError("");
    const outcome = signInFormOutcome(await onSignIn(values));

    if (!outcome) return;

    if (outcome.kind === "field") {
      setError(outcome.error);

      return;
    }

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  return { error, formSchema, onSubmit };
};
