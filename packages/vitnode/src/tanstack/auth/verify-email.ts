import { verifyEmailInputSchema } from "./contract";

export interface VerifyEmailSearch {
  token?: string;
}

export const normalizeVerifyEmailSearch = (
  input: Record<string, unknown>,
): VerifyEmailSearch => {
  const { token } = input;

  return typeof token === "string" && token !== "" ? { token } : {};
};

/**
 * `confirm` for a URL that carries a usable link, `resend` for anything else -
 * the bare page, and a token that could never be valid, both of which leave the
 * visitor needing a new link rather than a button that is bound to fail.
 */
export type VerifyEmailMode =
  | { mode: "confirm"; token: string }
  | { mode: "resend" };

export const verifyEmailMode = (search: VerifyEmailSearch): VerifyEmailMode => {
  const parsed = verifyEmailInputSchema.safeParse({ token: search.token });

  return parsed.success
    ? { mode: "confirm", token: parsed.data.token }
    : { mode: "resend" };
};

/** What both verify-email screens render strings from, crumb included. */
export const VERIFY_EMAIL_NAMESPACES = [
  "core.global",
  "core.auth.sign_up",
  "core.auth.verify_email",
] as const;

export type EmailVerificationAvailability =
  | "available"
  | "disabled"
  | "unknown";

/**
 * Whether this install confirms addresses at all - only one that can send
 * email does. Without an adapter every account is confirmed at sign-up, and the
 * page has nothing to offer.
 */
export const emailVerificationAvailability = ({
  isEmail,
  isKnown,
}: {
  isEmail: boolean;
  isKnown: boolean;
}): EmailVerificationAvailability => {
  if (!isKnown) return "unknown";

  return isEmail ? "available" : "disabled";
};

export class EmailVerificationUnknownError extends Error {
  constructor() {
    super(
      "The deployment configuration could not be read, so whether email confirmation is available is unknown.",
    );
    this.name = "EmailVerificationUnknownError";
  }
}
