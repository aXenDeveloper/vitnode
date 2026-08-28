"use client";

import { useRouter } from "@/lib/navigation";

import type { RecoveryLink } from "../recovery-link";

import { AUTH_HREF } from "../../auth-link";
import { ChangePasswordFormContent } from "./change-password-form-content";
import { mutationApi } from "./mutation-api.server";

/**
 * {@link ChangePasswordFormContent}, wired to Next.js.
 *
 * Two props, both Next-only: the server action, and `next-intl`'s locale-aware
 * `replace` for the trip to the login page once the password has changed. The
 * API mints no session on that change, so leaving for the login form is the
 * whole of the success path.
 */
export const ChangePasswordForm = ({ link }: { link: RecoveryLink }) => {
  const { replace } = useRouter();

  return (
    <ChangePasswordFormContent
      link={link}
      onChanged={() => {
        replace(AUTH_HREF.signIn);
      }}
      onChangePassword={mutationApi}
    />
  );
};
