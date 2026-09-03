import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const here = import.meta.dirname;

/** Source with its comments removed - prose may name what code may not do. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const modules = readdirSync(here)
  .filter(name => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"))
  .sort();

const codeOf = (name: string): string =>
  withoutComments(readFileSync(join(here, name), "utf8"));

const everyRoutePath = modules
  .flatMap(name => [...codeOf(name).matchAll(/path: "([^"]+)"/g)])
  .map(match => match[1])
  .sort();

describe("what this directory declares", () => {
  it("declares the shell-less screen, and only it", () => {
    expect(everyRoutePath).toEqual(["/admin"]);
  });

  it("declares no screen the main shell now owns", () => {
    for (const path of everyRoutePath) {
      expect(path.startsWith("/login"), path).toBe(false);
      expect(path, path).not.toBe("/register");
    }
  });
});

describe("how it reaches an application", () => {
  const index = codeOf("index.tsx");

  it("takes the host's locale rule as well as its page head", () => {
    expect(index).toContain("export const withCoreRootRoutes");
    expect(index).toMatch(/localeRouting/);
    expect(index).toMatch(/pageHead/);
    expect(index).toMatch(/mountUnder/);
  });

  it("builds its navigation from the injected rule", () => {
    const signIn = codeOf("admin-sign-in.tsx");

    expect(signIn).toContain("createAuthNavigation({");
    expect(signIn).toContain("localeRouting");
    // No second copy of the rule: no route here strips a prefix by hand. The
    // injected shape is named once, in `../types.ts`, which is the opposite of
    // a copy.
    for (const name of modules) {
      expect(codeOf(name), name).not.toContain("deLocalize");
    }
  });

  /** Idempotent, and a good neighbour - the same contract the other two have. */
  it("mounts under its own container, replacing any previous copy", () => {
    expect(index).toContain("CORE_ROOT_ROUTES_ROUTE_ID");
    expect(index).toContain("siblings");
    expect(index).toMatch(/addChildren\(\[\.\.\.siblings, container\]\)/);
  });

  it("writes nothing and reads no filesystem", () => {
    for (const name of modules) {
      const code = codeOf(name);

      expect(code, name).not.toMatch(/node:fs|writeFile|createFileRoute/);
      expect(code, name).not.toMatch(/src\/routes/);
    }
  });
});

describe("the guard this screen carries", () => {
  it("never redirects by href", () => {
    for (const name of modules) {
      expect(codeOf(name), name).not.toMatch(/redirect\(\{[^}]*href:/);
    }
  });

  it("reads the admin session tolerantly on the AdminCP entrance", () => {
    const signIn = codeOf("admin-sign-in.tsx");

    expect(signIn).toContain("prefetchAdminAccess");
    expect(signIn).not.toContain("ensureAdminAccess");
    expect(signIn).toMatch(
      /if \(!access \|\| !canEnterAdmin\(access\)\) return/,
    );
  });
});
