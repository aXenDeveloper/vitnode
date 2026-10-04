import { describe, expect, it } from "vitest";

import { postcssBrowserEmptyImports } from "./optimize-deps";

const POSTCSS_INPUT =
  "/repo/node_modules/.pnpm/postcss@8.5.28/node_modules/postcss/lib/input.js";

const hooks = postcssBrowserEmptyImports() as unknown as {
  load: { filter: { id: RegExp }; handler: (id: string) => string };
  resolveId: {
    filter: { id: RegExp };
    handler: (id: string, importer: string | undefined) => null | string;
  };
};

const resolve = (id: string, importer: string | undefined) =>
  hooks.resolveId.filter.id.test(id)
    ? hooks.resolveId.handler(id, importer)
    : null;

const load = (id: string) =>
  hooks.load.filter.id.test(id) ? hooks.load.handler(id) : null;

describe("postcss Node-only imports in the browser pre-bundle", () => {
  it.each(["fs", "path", "source-map-js", "url"])(
    "gives postcss an empty `%s` module instead of the warning stub",
    specifier => {
      const resolved = resolve(specifier, POSTCSS_INPUT);

      expect(resolved).not.toBeNull();
      expect(load(resolved ?? "")).toBe("module.exports = {};");
    },
  );

  it("leaves the same imports alone for every other package", () => {
    expect(
      resolve("path", "/repo/node_modules/sanitize-html/index.js"),
    ).toBeNull();
    expect(resolve("path", undefined)).toBeNull();
  });

  it("leaves postcss's other imports alone", () => {
    expect(resolve("nanoid/non-secure", POSTCSS_INPUT)).toBeNull();
    expect(load("/repo/node_modules/postcss/lib/postcss.js")).toBeNull();
  });
});
