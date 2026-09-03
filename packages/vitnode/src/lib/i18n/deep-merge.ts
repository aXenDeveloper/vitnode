type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
