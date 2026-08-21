/** Postgres error codes VitNode translates into a useful HTTP status. */
export const PG_ERROR_CODES = {
  foreignKeyViolation: "23503",
  notNullViolation: "23502",
  /**
   * `restrict_violation`. Postgres 17 reports this for a `NO ACTION`/`RESTRICT`
   * foreign key where earlier majors reported `23503`, so anything that acts on
   * "still referenced" has to accept both.
   */
  restrictViolation: "23001",
  uniqueViolation: "23505",
} as const;

/**
 * Digs the Postgres error code out of whatever the driver threw.
 *
 * Drizzle wraps driver failures in a `DrizzleQueryError` whose own `code` is
 * undefined and whose `cause` holds the real error, so reading `error.code`
 * alone would turn every constraint violation into a 500. The depth limit is
 * there because a `cause` chain is attacker-adjacent data in the sense that
 * matters here: it is arbitrary and can be cyclic.
 */
export const pgErrorCode = (error: unknown, depth = 0): string | undefined => {
  if (typeof error !== "object" || error === null || depth > 3) {
    return undefined;
  }

  const { cause, code } = error as { cause?: unknown; code?: unknown };
  if (typeof code === "string" && code !== "") return code;

  return pgErrorCode(cause, depth + 1);
};

/**
 * Whether a driver failure means "another row still points at this one".
 *
 * Both codes, for the reason `restrictViolation` documents: the same refused
 * delete reports one on Postgres 17 and the other on 16.
 */
export const isPgReferenceViolation = (error: unknown): boolean => {
  const code = pgErrorCode(error);

  return (
    code === PG_ERROR_CODES.foreignKeyViolation ||
    code === PG_ERROR_CODES.restrictViolation
  );
};
