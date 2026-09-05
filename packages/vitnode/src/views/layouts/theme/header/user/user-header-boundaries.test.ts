// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  externalGraph,
  NEXT_INTL,
  NEXT_ONLY,
  offenders,
  runtimeImports,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const SHARED = {
  content: join(here, "user-header-content.tsx"),
  model: join(here, "user-header-model.ts"),
};

const DELETED_NEXT_HALF = join(here, "next-user-header.tsx");

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

describe("the shared user header is framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL)).toEqual([]);
    },
  );

  it.each(sharedEntries)(
    "$name never reaches the locale-aware navigation module",
    ({ path }) => {
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.includes("navigation"))).toBe(false);
    },
  );

  it.each(sharedEntries)("$name never reaches a server action", ({ path }) => {
    const reached = [...externalGraph(path).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
      false,
    );
  });

  it("never reaches the session read either", () => {
    // The whole point of taking a state instead of fetching one: a shared
    // component that imported `getSessionApi` would pull `next/headers` in
    // behind it, and would be a second source of truth in the app that already
    // has a canonical session query.
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

  it("takes its links as a component", () => {
    expect(code).toContain("LinkComponent");
  });

  it("asks for a sign-out callback rather than calling a mutation", () => {
    expect(code).toContain("onSignOut");
    expect(code).not.toContain("logOutMutationApi");
  });

  it("renders a state rather than reading a session", () => {
    expect(code).toContain("state: UserHeaderState;");
    expect(code).not.toContain("useQuery");
  });
});

describe("the Next.js half of this subtree is gone", () => {
  it("no longer exists", () => {
    expect(existsSync(DELETED_NEXT_HALF)).toBe(false);
  });
});
