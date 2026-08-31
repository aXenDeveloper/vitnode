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

/**
 * How the form asks for an account.
 *
 * The whole of the framework boundary for registering, and deliberately one
 * function: it takes the field values and answers what happened, or nothing at
 * all. What it does on success - copy a session cookie, refresh a cached
 * session, navigate - is entirely the caller's business, which is why nothing
 * here handles it. Next.js redirects from a server action; TanStack Start calls
 * a server function, refreshes the canonical session query and moves the router.
 */
export type SignUpSubmit = (
  values: SignUpSubmitValues,
) => Promise<SignUpMutationResult>;

/**
 * The registration form's behaviour, with no idea which framework is rendering
 * it.
 *
 * `use-intl` rather than `next-intl` for the strings - the same module record
 * either way - so a Next.js page under `NextIntlClientProvider` and a TanStack
 * Start route under `IntlProvider` both resolve them.
 *
 * The schema is rebuilt on every render, as it always was: its messages are
 * translated strings, so a memoised one would keep the previous language after a
 * switch.
 *
 * ## Where the confirmation screen comes from
 *
 * `useWrapperSignUp` - the context {@link WrapperSignUp} mounts, which
 * {@link SignUpContent} renders for both frameworks. When the account was
 * created but not verified, this hands it the address and the wrapper swaps the
 * card for the "check your email" view. Nothing about that is Next-specific,
 * which is why it stayed a context rather than becoming a fifth prop: the form
 * is several levels below the component that has to change shape.
 */
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
