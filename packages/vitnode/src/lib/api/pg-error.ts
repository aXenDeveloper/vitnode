/** Postgres error codes VitNode translates into a useful HTTP status. */
export const PG_ERROR_CODES = {
  foreignKeyViolation: "23503",
  notNullViolation: "23502",

  restrictViolation: "23001",
  uniqueViolation: "23505",
} as const;

export const pgErrorCode = (error: unknown, depth = 0): string | undefined => {
  if (typeof error !== "object" || error === null || depth > 3) {
    return undefined;
  }

  const { cause, code } = error as { cause?: unknown; code?: unknown };
  if (typeof code === "string" && code !== "") return code;

  return pgErrorCode(cause, depth + 1);
};

export const isPgReferenceViolation = (error: unknown): boolean => {
  const code = pgErrorCode(error);

  return (
    code === PG_ERROR_CODES.foreignKeyViolation ||
    code === PG_ERROR_CODES.restrictViolation
  );
};
