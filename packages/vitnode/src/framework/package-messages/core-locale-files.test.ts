// @vitest-environment node
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CORE_LOCALE_FILES, CORE_PLUGIN_ID } from "./core.js";

const localesDir = join(import.meta.dirname, "..", "..", "locales");

/** The top-level `*.json` files the package's `exports` map publishes. */
const shipped = readdirSync(localesDir, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
  .map(entry => entry.name.replace(/\.json$/, ""))
  .sort();

describe("core's declared locale files", () => {
  it("names every locale the package ships and no other", () => {
    expect(Object.keys(CORE_LOCALE_FILES).sort()).toEqual(shipped);
  });

  it("points each one at the subpath the exports map publishes", () => {
    for (const [code, specifier] of Object.entries(CORE_LOCALE_FILES)) {
      expect(specifier).toBe(`${CORE_PLUGIN_ID}/locales/${code}.json`);
    }
  });

  /**
   * `src/locales/api/` is the server's email strings, and a web bundle has no
   * use for them - the split is the whole point of `buildApiMessagesSources`.
   */
  it("leaves the API's own tree out of it", () => {
    expect(Object.values(CORE_LOCALE_FILES).join(" ")).not.toContain(
      "/locales/api/",
    );
  });
});
