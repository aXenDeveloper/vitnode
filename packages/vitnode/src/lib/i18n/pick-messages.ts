const UNSAFE_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/** Whether any segment of a dotted message path is one of the unsafe three. */
export const isUnsafeMessagePath = (path: string): boolean =>
  path.split(".").some(segment => UNSAFE_SEGMENTS.has(segment));

const defineOwn = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void => {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

export const pickMessages = (
  obj: object,
  paths: readonly string[],
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const path of paths) {
    if (typeof path !== "string" || isUnsafeMessagePath(path)) continue;

    const keys = path.split(".");
    let src: Record<string, unknown> = obj as Record<string, unknown>;
    let dest = result;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      // `hasOwn` rather than `in`: an inherited key is not a message, and
      // following one is how traversal escapes the tree it was given.
      if (!Object.hasOwn(src, key)) break;

      if (i === keys.length - 1) {
        defineOwn(dest, key, src[key]);
        break;
      }

      const nextSrc = src[key];
      // A non-object in the middle of a path means the path is longer than the
      // tree is deep; there is nothing further to copy.
      if (typeof nextSrc !== "object" || nextSrc === null) break;

      if (!Object.hasOwn(dest, key)) defineOwn(dest, key, {});
      const nextDest = dest[key];
      // Only when an earlier path already put a leaf here. Overwriting it with
      // a branch would silently drop the string that was picked first.
      if (typeof nextDest !== "object" || nextDest === null) break;

      dest = nextDest as Record<string, unknown>;
      src = nextSrc as Record<string, unknown>;
    }
  }

  return result;
};
