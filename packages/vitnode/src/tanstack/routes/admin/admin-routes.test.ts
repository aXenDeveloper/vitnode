import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The AdminCP's screens are `@vitnode/core`'s, and they are declared here.
 *
 * Static and pure: this directory is read as the text it is. Nothing builds a
 * router or renders a screen - `apps/web/src/tests/admin-routes.test.ts` does
 * that, against the real tree, which is the only place the question "does
 * `/admin/core/users` resolve" can honestly be asked.
 *
 * ## The regression this exists for
 *
 * Every one of these screens used to be a route file in the *application*:
 * `apps/web/src/routes/_admin/` held seventeen `createFileRoute` calls, and the
 * scaffold shipped a copy of all seventeen to every new project. Not one of them
 * was the application's - the loader, the component, the breadcrumb and the
 * search normaliser all came from this package, and the file existed only so a
 * file-based router would see a path. So an app that installed VitNode carried a
 * copy of VitNode's own routing table, and core adding a screen was an edit in
 * every application that had one.
 *
 * What this file pins is that they cannot drift back: the declarations are here,
 * they are mounted through one exported function, and that function is the only
 * way in.
 */

const here = import.meta.dirname;

/** Source with its comments removed - prose may name what code may not do. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const modules = readdirSync(here)
  .filter(name => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"))
  .sort();

const codeOf = (name: string): string =>
  withoutComments(readFileSync(join(here, name), "utf8"));

/**
 * Every AdminCP URL this directory declares.
 *
 * Read as string and template literals beginning `/admin`, rather than as
 * `path:` alone, because two of these screens are built by a factory that takes
 * its path as an argument - the staff family, where one declaration spells two
 * URLs. A template literal is kept verbatim (`/admin/core/staff/${type}s/edit/$id`),
 * which is what the assertions below want: they are about what is claimed, not
 * about how many routes come out of it.
 */
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

  /**
   * Every path is a full `/admin/…` URL.
   *
   * The container these hang from is pathless, so a route's `path` is its whole
   * public URL - exactly what it was when the same screen was a file in an
   * application. A relative path here would silently move a screen.
   */
  it("spells every path in full, under /admin", () => {
    for (const path of everyRoutePath) {
      expect(path.startsWith("/admin/"), path).toBe(true);
    }
  });

  /** No two screens claim one URL. */
  it("claims each URL once", () => {
    expect([...new Set(everyRoutePath)]).toEqual(everyRoutePath);
  });

  /**
   * Exactly one splat, and it is the Content Engine's.
   *
   * A catch-all consumes every admin URL beneath it, so a second one - or a
   * wider first - is how the AdminCP breaks: the panel's own not-found stops
   * being reachable and a plugin's admin route is shadowed, silently and all at
   * once. `/admin/content/$` is the namespace the Content Engine owns outright.
   *
   * This is also the route that could not have gone through the plugin route
   * manifest: a catch-all is not representable in its path grammar, by design.
   */
  it("declares one splat, at the Content Engine namespace", () => {
    // A splat ends in a bare `/$`. A dynamic segment (`/$id`) does not, and
    // there are three of those - the two staff edit screens and one user.
    expect(everyRoutePath.filter(path => path.endsWith("/$"))).toEqual([
      "/admin/content/$",
    ]);
    // Two dynamic segments, both `$id` - the staff edit family and one user.
    expect(everyRoutePath.filter(path => path.includes("$id")).length).toBe(2);
  });

  /**
   * The dashboard is **not** declared here, and that is a framework constraint
   * rather than an oversight.
   *
   * A pathless layout route with no *file* children is dropped from the
   * generated route tree outright, and collapses to a full path of `/` where it
   * collides with the home page. So an application's `_admin.tsx` needs one
   * file-based child with a real path in order to exist at all, and
   * `admin.core.index.tsx` - the dashboard, at `/admin/core` - is it. Declaring
   * it here as well would be two routes claiming one URL.
   */
  it("leaves /admin/core to the application's one anchor route file", () => {
    expect(everyRoutePath).not.toContain("/admin/core");
  });
});

describe("how they reach an application", () => {
  const index = codeOf("index.tsx");

  /**
   * One exported mount, and it takes what a package cannot know: the shell to
   * hang from, the site's name, and which content types this installation
   * configured.
   */
  it("exports one mount that takes the host's own bindings", () => {
    expect(index).toContain("export const withCoreAdminRoutes");
    expect(index).toMatch(/mountUnder/);
    expect(index).toMatch(/pageHead/);
    expect(index).toMatch(/contentRegistry/);
  });

  /**
   * Under a pathless container of its own, which is what makes mounting
   * idempotent - a dev server re-evaluates the module that composes the tree
   * without re-evaluating the generated one, and the route it mutates is the
   * same object.
   */
  it("mounts under its own pathless container, replacing any previous copy", () => {
    expect(index).toContain("CORE_ADMIN_ROUTES_ROUTE_ID");
    expect(index).toMatch(/id: CORE_ADMIN_ROUTES_ROUTE_ID/);
    expect(index).toContain("siblings");
    expect(index).toMatch(/addChildren\(\[\.\.\.siblings, container\]\)/);
  });

  /**
   * And it writes no file and reads no filesystem. These are route objects
   * handed to a router, not pages copied into an application - which is the
   * whole difference between this and what it replaced.
   */
  it("writes nothing and reads no filesystem", () => {
    for (const name of modules) {
      const code = codeOf(name);

      expect(code, name).not.toMatch(/node:fs|writeFile|createFileRoute/);
      expect(code, name).not.toMatch(/src\/routes/);
    }
  });
});

describe("what a screen may not do here", () => {
  /**
   * The session check belongs to the shell's `beforeLoad` and to nowhere else. A
   * screen that read it again could decide something the guard did not.
   *
   * This assertion followed the screens: it used to read
   * `apps/web/src/routes/_admin/*`, and every file it covered is now in this
   * directory.
   */
  it("leaves the session check to the shell's guard", () => {
    for (const name of modules) {
      const code = codeOf(name);

      expect(code, name).not.toMatch(/ensureAdminAccess|prefetchAdminAccess/);
      expect(code, name).not.toMatch(/redirect\(/);
    }
  });

  /**
   * A screen's own staff permission is checked in its loader, beside the query
   * it gates - `requireAdminPermission` - and never in the route declaration.
   * These carry topology; the tuple belongs where the API route's own
   * declaration can be quoted next to it.
   */
  it("states no permission tuple in a route declaration", () => {
    for (const name of modules) {
      expect(codeOf(name), name).not.toMatch(
        /can_view|can_edit|can_delete|can_run|can_clear_cache/,
      );
    }
  });
});
