/**
 * Process exit codes the CLI chooses between.
 *
 * `usage` is the conventional `2` for "the command line itself is wrong", so a
 * CI log can tell a typo from a failed build without reading the message.
 */
export const EXIT_CODE = {
  failure: 1,
  interrupted: 130,
  ok: 0,
  usage: 2,
} as const;

export type CliErrorKind = "config" | "runtime" | "usage" | "validation";

export interface CliErrorOptions {
  cause?: unknown;
  /** Extra lines printed under the message, indented. */
  details?: readonly string[];
  exitCode?: number;
  /** One actionable sentence, printed after the details. */
  hint?: string;
  /** Output a failed child process printed, shown when it explains the error. */
  output?: string;
}

/**
 * An error the CLI knows how to explain.
 *
 * Anything thrown that is *not* one of these is an internal error, and the
 * boundary prints its stack - a message VitNode did not write is not one it can
 * vouch for.
 */
export class CliError extends Error {
  constructor(
    kind: CliErrorKind,
    message: string,
    options: CliErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CliError";
    this.kind = kind;
    this.details = options.details ?? [];
    this.hint = options.hint;
    this.output = options.output;
    this.exitCode =
      options.exitCode ??
      (kind === "usage" ? EXIT_CODE.usage : EXIT_CODE.failure);
  }
  readonly details: readonly string[];
  readonly exitCode: number;
  readonly hint?: string;
  readonly kind: CliErrorKind;

  readonly output?: string;
}

/** The command line is wrong: an unknown flag, a missing confirmation. */
export class UserError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super("usage", message, options);
    this.name = "UserError";
  }
}

/** The project is not set up the way the command needs. */
export class ConfigError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super("config", message, options);
    this.name = "ConfigError";
  }
}

/** Something was checked and found invalid - a plugin, a schema. */
export class ValidationError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super("validation", message, options);
    this.name = "ValidationError";
  }
}

/** A real operation failed: a build, a migration, a child process. */
export class RuntimeError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super("runtime", message, options);
    this.name = "RuntimeError";
  }
}

export const isCliError = (error: unknown): error is CliError =>
  error instanceof CliError;

/**
 * The message of the innermost `cause` - for errors a library wraps, such as
 * Drizzle's "Failed query: SELECT 1" around the driver's `ECONNREFUSED`, where
 * only the inner one says what actually went wrong.
 */
export const rootCauseMessage = (error: unknown): string => {
  let current = error;
  for (let depth = 0; depth < 10; depth += 1) {
    const { cause } = (current ?? {}) as { cause?: unknown };
    if (!(cause instanceof Error) || cause.message === "") break;
    current = cause;
  }

  return errorMessage(current);
};

/** The message of anything thrown, for places that only need one line. */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
