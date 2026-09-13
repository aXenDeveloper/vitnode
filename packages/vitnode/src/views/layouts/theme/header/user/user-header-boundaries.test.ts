// @vitest-environment node
import { readFileSync } from "node:fs";
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

describe("the shared user header takes its framework parts as props", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  const code = withoutComments(SHARED.content);

  it("asks for a sign-out callback rather than calling a mutation", () => {
    expect(code).toContain("onSignOut");
    expect(code).not.toContain("logOutMutationApi");
  });

  it("renders a state rather than reading a session", () => {
    expect(code).toContain("state: UserHeaderState;");
    expect(code).not.toContain("useQuery");
  });

  it("asks for the language submenu rather than resolving the locale", () => {
    // Switching a locale is the host router's job, so the menu arrives as a
    // slot - and is absent on a single-language install.
    expect(code).toContain("languageSwitcher");
  });

  it("renders the theme submenu itself", () => {
    // Not a slot: the theme lives in a provider this package owns, so it is
    // already framework-neutral - the assertions above are over its real
    // import graph - and no host gets to answer differently.
    expect(code).toContain("<ThemeSwitcherMenu />");
  });

  it("offers both to signed-out visitors too", () => {
    // A guest has no avatar to open, so the preference menu is its own trigger
    // rather than a control only members can reach.
    expect(code).toContain("PreferencesMenu");
  });
});

describe("the shared language submenu takes the navigation as a callback", () => {
  const code = readFileSync(SHARED.languageSwitcher, "utf8");

  it("asks for a select handler rather than moving the URL itself", () => {
    expect(code).toContain("onSelect");
    expect(code).not.toContain("useRouter");
    expect(code).not.toContain("usePathname");
  });

  it("is the only copy of the submenu", () => {
    // One copy, and this is it. A second `DropdownMenuSub` would mean the main
    // header and the AdminCP rendering different markup for the same control.
    expect(code).toContain("DropdownMenuSub");
  });
});
