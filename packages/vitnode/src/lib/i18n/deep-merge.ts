type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Recursively merges `source` over `target` into a new object. Two plain
 * objects are merged key by key; anything else - strings, arrays, `null` -
 * replaces what was there.
 *
 * Message trees are merged instead of spread so a half-translated locale only
 * overrides the keys it actually defines, and the rest fall through to the
 * default locale rather than rendering as raw keys.
 */
export const deepMerge = <T extends PlainObject>(
  target: T,
  source: PlainObject,
): T => {
  const result: PlainObject = { ...target };

  for (const key of Object.keys(source)) {
    // Locale files are plain JSON, but a `__proto__` key would otherwise be
    // assigned onto the prototype instead of the object.
    if (key === "__proto__") continue;

    const incoming = source[key];
    const current = result[key];

    result[key] =
      isPlainObject(current) && isPlainObject(incoming)
        ? deepMerge(current, incoming)
        : incoming;
  }

  return result as T;
};
