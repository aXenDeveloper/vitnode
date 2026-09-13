// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph, runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const SHARED = {
  header: join(here, "header-content.tsx"),
};

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));
const withoutComments = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("the shared header is framework-neutral", () => {
  it.each(sharedEntries)(
    "$name never reaches a server-only module",
    ({ path }) => {
      // Importing one pulls the fetcher and the whole API module graph behind
      // it. The header's one mutation - sign-out - lives in the user slot,
      // which is a prop.
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.endsWith(".server"))).toBe(false);
      expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
        false,
      );
    },
  );

  it("never reaches a router", () => {
    // `@vitnode/core` renders in whatever host mounts it, so the shared header
    // reaches navigation through an injected `LinkComponent` rather than
    // through a router of its own.
    const reached = [...externalGraph(SHARED.header).keys()];

    expect(reached.some(one => one.startsWith("@tanstack/"))).toBe(false);
  });
});

describe("the shared header takes its framework parts as props", () => {
  const code = withoutComments(SHARED.header);

  it("takes its links as a component rather than importing one", () => {
    expect(code).toContain("LinkComponent");
  });

  it.each(["logo", "navigation", "user"])(
    "asks for %s rather than resolving it",
    slot => {
      expect(code).toContain(slot);
    },
  );

  it("translates nothing itself", () => {
    // The nav labels arrive as data, resolved from the message cache. A
    // `useTranslations` here would force `core.search` into every page's
    // client provider for two words.
    expect(code).not.toContain("useTranslations");
    expect(code).not.toContain("getTranslations");
  });

  it("carries no preference controls of its own", () => {
    // Theme and language moved into the user menu, which is the `user` slot.
    // A switcher back in the bar would be a second copy of both controls.
    expect(code).not.toContain("ThemeSwitcher");
    expect(code).not.toContain("languageSwitcher");
  });
});
