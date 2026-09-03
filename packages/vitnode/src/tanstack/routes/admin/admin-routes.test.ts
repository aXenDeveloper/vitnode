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
  .flatMap(name => [
    ...codeOf(name).matchAll(/["`](\/admin(?:\/[^"`\s]*)?)["`]/g),
  ])
  .map(match => match[1])
  .sort();

describe("what this directory declares", () => {
  /** Guards the guard: the assertions below are properties of a real listing. */
  it("declares the AdminCP's screens", () => {
    expect(modules).toContain("index.tsx");
    expect(everyRoutePath.length).toBeGreaterThan(10);
  });

  it("spells every path in full, under /admin", () => {
    for (const path of everyRoutePath) {
      expect(path.startsWith("/admin/"), path).toBe(true);
    }
  });

  /** No two screens claim one URL. */
  it("claims each URL once", () => {
    expect([...new Set(everyRoutePath)]).toEqual(everyRoutePath);
  });

  it("declares one splat, at the Content Engine namespace", () => {
    // A splat ends in a bare `/$`. A dynamic segment (`/$id`) does not, and
    // there are three of those - the two staff edit screens and one user.
    expect(everyRoutePath.filter(path => path.endsWith("/$"))).toEqual([
      "/admin/content/$",
    ]);
    // Two dynamic segments, both `$id` - the staff edit family and one user.
    expect(everyRoutePath.filter(path => path.includes("$id")).length).toBe(2);
  });

  it("leaves /admin/core to the application's one anchor route file", () => {
    expect(everyRoutePath).not.toContain("/admin/core");
  });
});

describe("how they reach an application", () => {
  const index = codeOf("index.tsx");

  it("exports one mount that takes the host's own bindings", () => {
    expect(index).toContain("export const withCoreAdminRoutes");
    expect(index).toMatch(/mountUnder/);
    expect(index).toMatch(/pageHead/);
    expect(index).toMatch(/loadContentRegistry/);
  });

  it("takes the content registry as a thunk rather than as a value", () => {
    expect(index).toMatch(
      /loadContentRegistry: \(\) => Promise<ContentFrontendRegistry>/,
    );
    expect(index).not.toMatch(/contentRegistry: ContentFrontendRegistry/);
  });

  it("mounts under its own pathless container, replacing any previous copy", () => {
    expect(index).toContain("CORE_ADMIN_ROUTES_ROUTE_ID");
    expect(index).toMatch(/id: CORE_ADMIN_ROUTES_ROUTE_ID/);
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

describe("what a screen may not do here", () => {
  it("leaves the session check to the shell's guard", () => {
    for (const name of modules) {
      const code = codeOf(name);

      expect(code, name).not.toMatch(/ensureAdminAccess|prefetchAdminAccess/);
      expect(code, name).not.toMatch(/redirect\(/);
    }
  });

  it("states no permission tuple in a route declaration", () => {
    for (const name of modules) {
      expect(codeOf(name), name).not.toMatch(
        /can_view|can_edit|can_delete|can_run|can_clear_cache/,
      );
    }
  });
});
