/** One suggested fix, shown on the development error page under the error. */
export interface DevErrorHint {
  /** What to change and why, in one or two sentences. */
  description: string;
  /** Code to copy, rendered as a code block. */
  snippet?: string;
  /** The fix in a few words, shown as the hint's heading. */
  title: string;
}

/**
 * An error that carries fix suggestions for the development error page.
 * Implement it on a custom `Error` class thrown for a configuration mistake;
 * production responses never show the hints.
 *
 * @example
 * ```ts
 * class MyConfigError extends Error implements DevErrorWithHints {
 *   readonly hints = [
 *     { title: "Set a title", description: "Add `metadata.title` to the config." },
 *   ];
 * }
 * ```
 */
export interface DevErrorWithHints {
  /** The suggestions; malformed entries are skipped. */
  readonly hints: readonly DevErrorHint[];
}

const isHint = (value: unknown): value is DevErrorHint => {
  if (typeof value !== "object" || value === null) return false;

  const { description, snippet, title } = value as Record<string, unknown>;

  return (
    typeof title === "string" &&
    typeof description === "string" &&
    (snippet === undefined || typeof snippet === "string")
  );
};

/** The well-formed hints an error carries, or `[]`. */
export const devErrorHintsOf = (error: unknown): DevErrorHint[] => {
  if (typeof error !== "object" || error === null || !("hints" in error)) {
    return [];
  }

  const { hints } = error;

  return Array.isArray(hints) ? hints.filter(isHint) : [];
};
