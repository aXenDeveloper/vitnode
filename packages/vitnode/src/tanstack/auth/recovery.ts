import type { RecoveryLink } from "@/views/auth/password-reset/recovery-link";

import { parseRecoveryLink } from "@/views/auth/password-reset/recovery-link";

export interface PasswordResetSearch {
  token?: string;
  userId?: number | string;
}

export const normalizePasswordResetSearch = (
  input: Record<string, unknown>,
): PasswordResetSearch => {
  const { token, userId } = input;

  return {
    ...(typeof token === "string" && token !== "" ? { token } : {}),
    ...(typeof userId === "number" ||
    (typeof userId === "string" && userId !== "")
      ? { userId }
      : {}),
  };
};

export type PasswordResetMode =
  { link: RecoveryLink; mode: "change" } | { mode: "request" };

export const passwordResetMode = (
  search: PasswordResetSearch,
): PasswordResetMode => {
  const link = parseRecoveryLink(search);

  return link ? { link, mode: "change" } : { mode: "request" };
};

const PASSWORD_RESET_BASE_NAMESPACES = [
  "core.global",
  "core.auth.sign_up",
  "core.auth.reset_password",
] as const;

/** The base set, plus the change-password screen's own copy. */
const CHANGE_PASSWORD_NAMESPACES = [
  ...PASSWORD_RESET_BASE_NAMESPACES,
  "core.auth.change_password",
] as const;

export const passwordResetNamespaces = (
  mode: PasswordResetMode["mode"],
): readonly string[] =>
  mode === "change"
    ? CHANGE_PASSWORD_NAMESPACES
    : PASSWORD_RESET_BASE_NAMESPACES;

export type PasswordRecoveryAvailability = "available" | "disabled" | "unknown";

export const passwordRecoveryAvailability = ({
  isEmail,
  isKnown,
}: {
  isEmail: boolean;
  isKnown: boolean;
}): PasswordRecoveryAvailability => {
  if (!isKnown) return "unknown";

  return isEmail ? "available" : "disabled";
};

export class PasswordRecoveryUnknownError extends Error {
  constructor() {
    super(
      "The deployment configuration could not be read, so whether password recovery is available is unknown.",
    );
    this.name = "PasswordRecoveryUnknownError";
  }
}
