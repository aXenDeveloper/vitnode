/**
 * Path segments that must never be traversed into or written to.
 *
 * `__proto__` is the dangerous one: on an ordinary object it is an accessor
 * inherited from `Object.prototype`, so `target["__proto__"] = value` does not
 * create a property - it *replaces the prototype*. `constructor` and
 * `prototype` are the two steps of the other well-known route to the same
 * place, `x.constructor.prototype`.
 *
 * None of the three is a namespace any package ships, so rejecting them costs
 * nothing and closes the hole for every caller at once.
 */
const UNSAFE_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/** Whether any segment of a dotted message path is one of the unsafe three. */
export const isUnsafeMessagePath = (path: string): boolean =>
  path.split(".").some(segment => UNSAFE_SEGMENTS.has(segment));

/**
 * Writes an own, enumerable property - and nothing else.
 *
 * `defineProperty` rather than `target[key] = value` because assignment
 * consults the prototype chain for a setter, which is exactly the behaviour
 * that turns a `__proto__` key into prototype pollution. This defines the
 * property directly on the object, so even a message file that somehow ships a
 * literal `__proto__` key (`JSON.parse` will happily create one as an *own*
 * property) produces an inert piece of data rather than a new prototype.
 */
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

/**
 * The subset of a message tree a client bundle is allowed to see.
 *
 * Exported so the namespace rule is testable on its own: which namespaces reach
 * the client is the difference between a plugin's admin screen rendering and
 * every string on it throwing `MISSING_MESSAGE`, and that is a rule worth
 * pinning rather than a detail of a server component.
 *
 * A path that resolves to nothing is skipped, not defaulted - an unregistered
 * plugin id simply contributes no messages. A path containing an unsafe segment
 * is skipped too: this is a shared utility reached from a public server
 * function, and it does not get to assume every caller validated its input
 * first. `apps/web` rejects such input outright before it arrives here; this is
 * the second lock on the same door.
 *
 * The result is an ordinary object rather than a `null`-prototype one on
 * purpose. It is handed to `NextIntlClientProvider` from a Server Component,
 * and React's Flight serializer refuses anything whose prototype is not
 * `Object.prototype` - `isSimpleObject` returns false and the render fails with
 * "Only plain objects... can be passed to Client Components". `defineOwn` above
 * gives the same protection without changing what the object *is*.
 */
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
