import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph, runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../../..");

const SHARED = {
  content: join(here, "user-header-content.tsx"),
  /** The language submenu the user menu renders through its slot. */
  languageSwitcher: join(
    srcRoot,
    "components/switchers/langs/language-switcher-menu.tsx",
  ),
  model: join(here, "user-header-model.ts"),
  /** The theme submenu, rendered directly - see below. */
  themeSwitcher: join(
    srcRoot,
    "components/switchers/themes/theme-switcher-menu.tsx",
  ),
};

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

describe("the shared user header is framework-neutral", () => {
  it.each(sharedEntries)(
    "$name never reaches a server-only module",
    ({ path }) => {
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.endsWith(".server"))).toBe(false);
      expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
        false,
      );
    },
  );

  it("never reaches the session read either", () => {
    // The whole point of taking a state instead of fetching one: a shared
    // component that imported `getSessionApi` would be a second source of
    // truth in the app that already has a canonical session query.
    const reached = [...externalGraph(SHARED.content).keys()];

    expect(reached.some(one => one.includes("get-session-api"))).toBe(false);
  });
});
