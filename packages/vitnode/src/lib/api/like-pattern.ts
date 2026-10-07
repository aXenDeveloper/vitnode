/**
 * Escapes the `LIKE` wildcards so a search for "100%" matches the literal text
 * rather than every row. Backslash is Postgres' default escape character.
 */
export const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, match => `\\${match}`);

/** `%term%` with the term's own wildcards escaped - a literal "contains". */
export const containsLikePattern = (value: string): string =>
  `%${escapeLikePattern(value)}%`;
