// @vitest-environment node
import { describe, expect, it } from "vitest";

import { lazyImportSpecifier } from "./component-source.js";

/**
 * Reading a page's specifier off a `lazy()` callback, which is the only way a
 * build can check that the module a route names exists.
 *
 * `lazy()` deliberately never calls the callback, so there is nothing to observe
 * by running it - and the answer is allowed to be "cannot tell". Every case
 * below that returns `null` is a case where failing a build would be guessing.
 *
 * The callbacks are compiled from source rather than written as real dynamic
 * imports, because this test file is itself transformed: Vite rewrites an
 * `import()` in a test into a call to its own loader, which is precisely the
 * "already rewritten" case the last test pins. What the build actually reads is
 * a plugin's compiled `dist`, where the import is still an `import`.
 */
const callback = (source: string): unknown =>
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(`return ${source}`)() as unknown;

describe("lazyImportSpecifier", () => {
  it("reads a relative specifier out of an arrow function", () => {
    expect(lazyImportSpecifier(callback('()=>import("./pages/x.js")'))).toBe(
      "./pages/x.js",
    );
  });

  it("reads one written with single quotes", () => {
    expect(lazyImportSpecifier(callback("() => import('./pages/y.js')"))).toBe(
      "./pages/y.js",
    );
  });

  it("reads one with import attributes after it", () => {
    expect(
      lazyImportSpecifier(
        callback('() => import("./pages/x.js", { with: { type: "json" } })'),
      ),
    ).toBe("./pages/x.js");
  });

  it("reads a parent-relative specifier", () => {
    expect(lazyImportSpecifier(callback('()=>import("../pages/z.js")'))).toBe(
      "../pages/z.js",
    );
  });

  it("reads through an async function that awaits the import", () => {
    expect(
      lazyImportSpecifier(callback('async () => await import("./pages/x.js")')),
    ).toBe("./pages/x.js");
  });

  it("ignores a bare specifier, which resolves through a package rather than a path", () => {
    expect(
      lazyImportSpecifier(callback('() => import("@acme/other/page")')),
    ).toBeNull();
  });

  it("cannot tell for a callback that imports nothing", () => {
    expect(
      lazyImportSpecifier(callback("() => Promise.resolve({})")),
    ).toBeNull();
  });

  it("cannot tell for a callback with more than one import", () => {
    expect(
      lazyImportSpecifier(
        callback(
          '() => Promise.all([import("./pages/x.js"), import("./pages/y.js")])',
        ),
      ),
    ).toBeNull();
  });

  it("cannot tell for a computed specifier", () => {
    expect(
      lazyImportSpecifier(callback("(name) => import(`./pages/${name}.js`)")),
    ).toBeNull();
  });

  it("cannot tell for a callback a bundler has already rewritten", () => {
    expect(
      lazyImportSpecifier(
        callback('() => __vite_ssr_dynamic_import__("./pages/x.js")'),
      ),
    ).toBeNull();
  });

  it("is null for anything that is not a function", () => {
    expect(lazyImportSpecifier(undefined)).toBeNull();
    expect(lazyImportSpecifier("./pages/x.js")).toBeNull();
    expect(lazyImportSpecifier({ load: () => null })).toBeNull();
  });
});
