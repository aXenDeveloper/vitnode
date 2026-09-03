/** A recovery link this app is willing to act on. */
export interface RecoveryLink {
  token: string;
  userId: number;
}

const RECOVERY_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const RECOVERY_TOKEN_MIN_LENGTH = 16;
const RECOVERY_TOKEN_MAX_LENGTH = 512;

const recoveryToken = (value: unknown): null | string =>
  typeof value === "string" &&
  value.length >= RECOVERY_TOKEN_MIN_LENGTH &&
  value.length <= RECOVERY_TOKEN_MAX_LENGTH &&
  RECOVERY_TOKEN_PATTERN.test(value)
    ? value
    : null;

const RECOVERY_USER_ID_PATTERN = /^\d+$/;

const recoveryUserId = (value: unknown): null | number => {
  const coerced =
    typeof value === "number"
      ? value
      : typeof value === "string" && RECOVERY_USER_ID_PATTERN.test(value)
        ? Number(value)
        : null;

  return coerced !== null &&
    Number.isInteger(coerced) &&
    coerced > 0 &&
    coerced <= Number.MAX_SAFE_INTEGER
    ? coerced
    : null;
};

export const parseRecoveryLink = (input: {
  token?: unknown;
  userId?: unknown;
}): null | RecoveryLink => {
  const token = recoveryToken(input.token);
  const userId = recoveryUserId(input.userId);

  return token === null || userId === null ? null : { token, userId };
};
