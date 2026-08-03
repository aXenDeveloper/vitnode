import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

/** Postgres error codes the engine translates into a useful HTTP status. */
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const NOT_NULL_VIOLATION = "23502";

/**
 * Digs the Postgres error code out of whatever the driver threw.
 *
 * Drizzle wraps driver failures in a `DrizzleQueryError` whose own `code` is
 * undefined and whose `cause` holds the real error, so reading `error.code`
 * alone would turn every constraint violation into a 500.
 */
const errorCode = (error: unknown, depth = 0): string | undefined => {
  if (typeof error !== "object" || error === null || depth > 3)
    return undefined;

  const { cause, code } = error as { cause?: unknown; code?: unknown };
  if (typeof code === "string" && code !== "") return code;

  return errorCode(cause, depth + 1);
};

/**
 * Turns a Postgres constraint failure into an HTTP response.
 *
 * The driver's message can name columns, constraints and even values, so it
 * never reaches the client - only a generic sentence does. Anything unrecognised
 * is rethrown for `app.onError`, which logs the detail and returns a bare 500.
 */
export const rethrowAsHttpError = (
  error: unknown,
  { action }: { action: "create" | "delete" | "update" },
): never => {
  // The service validates its own input, so a payload that slipped past the
  // route's validator surfaces here. The issue tree stays out of the response:
  // it names internal field paths, and the route schema already described the
  // contract in OpenAPI.
  if (error instanceof ZodError) {
    throw new HTTPException(400, { message: "Invalid input data." });
  }

  switch (errorCode(error)) {
    case FOREIGN_KEY_VIOLATION:
      throw new HTTPException(action === "delete" ? 409 : 400, {
        message:
          action === "delete"
            ? "This record is still referenced by other content."
            : "A related record does not exist.",
      });
    case NOT_NULL_VIOLATION:
      throw new HTTPException(400, { message: "A required field is missing." });
    case UNIQUE_VIOLATION:
      throw new HTTPException(409, {
        message: "A record with these values already exists.",
      });
    default:
      throw error;
  }
};

/** Runs a write and maps any constraint failure onto an HTTP status. */
export const withHttpErrors = async <TResult>(
  action: "create" | "delete" | "update",
  run: () => Promise<TResult>,
): Promise<TResult> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HTTPException) throw error;

    return rethrowAsHttpError(error, { action });
  }
};
