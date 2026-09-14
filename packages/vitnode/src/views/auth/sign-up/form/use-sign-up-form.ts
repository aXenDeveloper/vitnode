import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { setFormFieldError } from "@/components/ui/form";

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
      setFormFieldError(
        form,
        outcome.field,
        outcome.field === "email" ? t("email.exists") : t("username.exists"),
      );

      return;
    }

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  return { formSchema, onSubmit };
};
