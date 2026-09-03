import type { SignUpResult } from "./contract";

export const shouldRefreshSessionAfterSignUp = (
  result: SignUpResult,
): boolean => result.ok && result.emailVerified;
