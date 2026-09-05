/**
 * More than any page has ever needed, and few enough that a caller asking for
 * thousands is refused rather than served.
 */
export const MAX_NAMESPACES = 16;

/** `@vitnode/some-plugin.a.b.c` is four; nothing real goes deeper. */
export const MAX_NAMESPACE_DEPTH = 8;

/** Comfortably longer than the longest plugin id plus a namespace path. */
export const MAX_NAMESPACE_LENGTH = 128;

const UNSAFE_NAMESPACE_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export const namespaceProblem = (value: unknown): null | string => {
  if (typeof value !== "string") return "must be a string.";
  if (value.length === 0) return "must not be empty.";
  if (value.length > MAX_NAMESPACE_LENGTH) {
    return `must be at most ${MAX_NAMESPACE_LENGTH} characters.`;
  }

  const segments = value.split(".");

  if (segments.length > MAX_NAMESPACE_DEPTH) {
    return `must be at most ${MAX_NAMESPACE_DEPTH} segments.`;
  }

  for (const segment of segments) {
    // `core..global`, a leading dot, a trailing dot - all malformed, and all of
    // them paths that would walk somewhere nobody meant.
    if (segment.length === 0) return "must not contain an empty segment.";
    if (UNSAFE_NAMESPACE_SEGMENTS.has(segment)) {
      return "contains a forbidden segment.";
    }
  }

  return null;
};

/**
 * A namespace list in a form two writers cannot spell differently.
 *
 * De-duplicated and sorted by **code unit**, not by `localeCompare`: this list
 * is written into a generated file, and a manifest that reorders itself on a
 * machine with a different locale is a diff that only appears on someone else's
 * laptop.
 *
 * Normalisation only - it assumes strings and says nothing about whether they
 * are acceptable. That is {@link namespaceProblem}'s job.
 */
export const normalizeNamespaceList = (
  namespaces: readonly string[],
): string[] =>
  [...new Set(namespaces)].sort((a, b) => {
    if (a === b) return 0;

    return a < b ? -1 : 1;
  });
