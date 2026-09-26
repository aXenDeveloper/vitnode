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
  const [failure, setFailure] = React.useState<{
    error: SignInFormError;
    repeat: number;
  }>({ error: "", repeat: 0 });
  const t = useTranslations("core.auth.sign_in");
  const tErrors = useTranslations("core.global.errors");
  const formSchema = createSignInFormSchema({
    invalidEmail: t("email.invalid"),
    passwordRequired: t("password.required"),
  });

  const onSubmit: AutoFormOnSubmit<SignInFormSchema> = async values => {
    const outcome = signInFormOutcome(await onSignIn(values));

    if (outcome?.kind === "field") {
      setFailure(current => ({
        error: outcome.error,
        repeat: current.error === outcome.error ? current.repeat + 1 : 0,
      }));

      return;
    }

    setFailure({ error: "", repeat: 0 });

    if (!outcome) return;

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  return { ...failure, formSchema, onSubmit };
};
