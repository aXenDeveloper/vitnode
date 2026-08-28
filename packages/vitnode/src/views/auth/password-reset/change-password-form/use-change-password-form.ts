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

/**
 * How the form sets a new password.
 *
 * The whole of the framework boundary for password recovery's second half. It
 * takes the new password together with the already-parsed link it is acting on,
 * and answers what happened. Next.js calls a server action; TanStack Start calls
 * a server function.
 */
export type ChangePasswordSubmit = (
  values: ChangePasswordSubmitValues,
) => Promise<ChangePasswordMutationResult>;

/**
 * The change-password form's behaviour, with no idea which framework is
 * rendering it.
 *
 * Two props, and both are things this side cannot answer:
 *
 * - `onChangePassword` - the mutation.
 * - `onChanged` - where to go afterwards. The API mints **no session** on a
 *   successful change, so the visitor is still signed out and the only sensible
 *   destination is the login page - but *how* to get there is `useRouter().replace`
 *   in Next.js and a router navigation in TanStack Start, so the caller does it.
 *
 * `link` is a {@link RecoveryLink}, which means it has already been through
 * `parseRecoveryLink`: this hook never sees a raw search parameter and never
 * coerces one.
 *
 * The toasts stay on this side deliberately - they are the same two messages for
 * the same two reasons in both frameworks. An expired or already-used link gets
 * the `400` copy rather than the generic internal-error copy, because it is the
 * one failure a visitor can act on: ask for a fresh link.
 */
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
