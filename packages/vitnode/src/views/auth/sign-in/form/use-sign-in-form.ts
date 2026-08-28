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

/**
 * How the form asks for a session.
 *
 * The whole of the framework boundary for signing in, and deliberately one
 * function: it takes the two field values and answers what went wrong, or
 * nothing at all. What it does on success - set a cookie, revalidate a layout,
 * navigate - is entirely the caller's business, which is why nothing here
 * handles it. Next.js redirects from a server action; TanStack Start calls the
 * API and moves the router.
 */
export type SignInSubmit = (
  values: SignInFormValues,
) => Promise<SignInMutationResult>;

/**
 * The sign-in form's behaviour, with no idea which framework is rendering it.
 *
 * `use-intl` rather than `next-intl` for the strings - the same record either
 * way (`next-intl`'s client entry *is* `use-intl` re-exported), so a Next.js
 * page under `NextIntlClientProvider` and a TanStack Start route under
 * `IntlProvider` both resolve them.
 *
 * The schema is rebuilt on every render, as it always was: its messages are
 * translated strings, so a memoised one would keep the previous language after
 * a switch.
 */
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
