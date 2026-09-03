/**
 * The module specifier inside a `lazy(() => import("./pages/x"))` callback, read
 * off the compiled function.
 *
 * A best-effort diagnostic, and typed to say so: `null` means "this build cannot
 * tell", which is the honest answer for a callback a bundler has already
 * rewritten, one that awaits something computed, or one that imports more than
 * one module. Nothing depends on the result being present - it exists so that a
 * mistyped page path fails the build naming the plugin and the route, instead of
 * failing in a browser the first time somebody opens the page.
 *
 * `Function.prototype.toString` is the only way in: `lazy()` deliberately keeps
 * the callback un-called - that is the whole point of it - so the specifier
 * cannot be observed by running anything. What it returns is the source of the
 * arrow function as it exists in the plugin's build output, which for the shape
 * this looks for is `()=>import("./pages/product-page.js")`.
 *
 * Only *relative* specifiers are returned. A bare one (`"@acme/other/page"`) is
 * resolved by the plugin's own dependency graph rather than by a path on disk,
 * and the caller has no business guessing where it lives.
 */
const IMPORT_CALL = /\bimport\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$\\]*)`)\s*[,)]/g;

export const lazyImportSpecifier = (load: unknown): null | string => {
  if (typeof load !== "function") return null;

  const source = String(load);
  const found = [...source.matchAll(IMPORT_CALL)].map(
    match => match[1] ?? match[2] ?? match[3],
  );

  if (found.length !== 1) return null;

  const [specifier] = found;

  if (!specifier?.startsWith(".")) return null;

  return specifier;
};
