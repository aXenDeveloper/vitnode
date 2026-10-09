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

export type VerifyEmailMode =
  | { mode: "confirm"; token: string }
  | { mode: "resend" };

export const verifyEmailMode = (search: VerifyEmailSearch): VerifyEmailMode => {
  const parsed = verifyEmailInputSchema.safeParse({ token: search.token });

  return parsed.success
    ? { mode: "confirm", token: parsed.data.token }
    : { mode: "resend" };
};

export const VERIFY_EMAIL_NAMESPACES = [
  "core.global",
  "core.auth.sign_up",
  "core.auth.verify_email",
] as const;

export type EmailVerificationAvailability =
  | "available"
  | "disabled"
  | "unknown";

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
