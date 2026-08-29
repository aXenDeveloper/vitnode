/**
 * Message namespaces, as one rule two layers apply.
 *
 * A namespace is a path into the merged message tree - `core.global`,
 * `@vitnode/blog.post` - and it is written down in two very different places: a
 * plugin *declares* the ones its route renders, at build time, in a manifest; a
 * browser *asks* for a set of them at runtime, through a server function that is
 * a public `POST` endpoint. The declaration is trusted and the request is not,
 * but what makes a namespace legal is the same question in both, so it is
 * answered once here.
 *
 * Pure and import-free, like everything in this layer: it is read by a build
 * running in Node with no framework loaded, by an app's browser bundle, and by
 * the i18n runtime that owns the fetch - see `@vitnode/core/tanstack/i18n`,
 * which validates its server function's input with {@link namespaceProblem}
 * rather than a second copy of these rules.
 */

/**
 * More than any page has ever needed, and few enough that a caller asking for
 * thousands is refused rather than served.
 */
export const MAX_NAMESPACES = 16;

/** `@vitnode/some-plugin.a.b.c` is four; nothing real goes deeper. */
export const MAX_NAMESPACE_DEPTH = 8;

/** Comfortably longer than the longest plugin id plus a namespace path. */
export const MAX_NAMESPACE_LENGTH = 128;

/**
 * Segments that must never reach a message tree walk.
 *
 * `__proto__`, `constructor` and `prototype` are the three steps of prototype
 * pollution. They are rejected rather than quietly dropped, because a namespace
 * containing one is not a namespace with a typo in it.
 */
const UNSAFE_NAMESPACE_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * What is wrong with one namespace, or `null` if nothing is.
 *
 * Returns the *predicate half* of a sentence - "must be a string." - so each
 * caller can put its own subject in front of it: the i18n server function says
 * `namespaces[0] must be a string.` and a route manifest names the plugin and
 * the route instead. One rule, two vocabularies, no drift.
 *
 * Deliberately says *what* was wrong and never *what was sent*: at the runtime
 * end the value is attacker-controlled and the message reaches a server log.
 */
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
