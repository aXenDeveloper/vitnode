import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The public site's screens are `@vitnode/core`'s, and they are declared here.
 *
 * Static and pure: this directory is read as the text it is. Nothing builds a
 * router or renders a screen - `apps/web/src/tests/` does that, against the real
 * tree, which is the only place "does `/settings/devices` resolve" can honestly
 * be asked.
 *
 * ## The regression this exists for
 *
 * Every screen here used to be a route file in the *application*.
 * `apps/web/src/routes/_main/` held nine of them - discover, search, my files,
 * the settings frame and its four panels, plus the pathless guard above them -
 * and the scaffold shipped a copy of all nine to every new project. Not one was
 * the application's: the loader, the component, the search normaliser and the
 * breadcrumb all came from this package, and the file existed only so a
 * file-based router would see a path. So an app that installed VitNode carried a
 * copy of VitNode's own routing table, and core adding a screen was an edit in
 * every application that had one.
 *
 * It is the same duplication a copied plugin page is, one package up. What this
 * file pins is that it cannot come back: the declarations are here, they are
 * mounted through one exported function, and that function is the only way in.
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

const everyRoutePath = modules
  .flatMap(name => [...codeOf(name).matchAll(/path: "([^"]+)"/g)])
  .map(match => match[1])
  .sort();

describe("what this directory declares", () => {
  /** Guards the guard: the assertions below are properties of a real listing. */
  it("declares the public site's screens", () => {
    expect(modules).toContain("index.tsx");
    expect(everyRoutePath).toContain("/discover");
    expect(everyRoutePath).toContain("/search");
    expect(everyRoutePath).toContain("/files");
    expect(everyRoutePath).toContain("/settings");
  });

  /**
   * Every path is either a full public URL or a settings panel's, relative to
   * the frame it hangs under.
   *
   * The containers these mount on are pathless, so a top-level screen's `path`
   * is its whole public URL. The settings panels are the one nested set - they
   * are children of the `/settings` layout, so `/overview` means
   * `/settings/overview`, and `"/"` is the frame's own index.
   */
  it("spells a top-level path in full and a panel's relative to its frame", () => {
    const PANELS = ["/", "/overview", "/security", "/devices"];

    for (const path of everyRoutePath) {
      expect(path.startsWith("/"), path).toBe(true);
      if (!PANELS.includes(path)) {
        expect(
          ["/discover", "/files", "/search", "/settings"].includes(path),
          path,
        ).toBe(true);
      }
    }
  });

  /** No two screens claim one path in one parent. */
  it("claims each path once", () => {
    // `/overview` and `/` both render the overview panel, at two URLs, which is
    // the documented alias - but they are two distinct paths.
    expect([...new Set(everyRoutePath)]).toEqual(everyRoutePath);
  });

  /** No splat out here. The only one VitNode has is the Content Engine's. */
  it("declares no catch-all", () => {
    expect(everyRoutePath.filter(path => path.includes("$"))).toEqual([]);
  });

  /**
   * `/` is **not** declared here, and that is a framework constraint rather than
   * an oversight.
   *
   * A pathless layout route with no *file* children is dropped from the
   * generated route tree outright, and collapses to a full path of `/`. So an
   * application's `_main.tsx` needs one file-based child with a real path in
   * order to exist at all - and its front page is that child, which is also the
   * one page on the public site that is genuinely the application's rather than
   * VitNode's.
   */
  it("leaves the front page to the application", () => {
    expect(everyRoutePath).not.toContain("/");
    expect(everyRoutePath.filter(path => path === "/").length).toBeLessThan(2);
  });
});

describe("how they reach an application", () => {
  const index = codeOf("index.tsx");

  /** One exported mount, taking the shell to hang from and the site's name. */
  it("exports one mount that takes the host's own bindings", () => {
    expect(index).toContain("export const withCoreMainRoutes");
    expect(index).toMatch(/mountUnder/);
    expect(index).toMatch(/pageHead/);
  });

  /**
   * Under two pathless containers: the public one, and the signed-in guard
   * nested inside it. Nesting the guard is what lets `/files` and the settings
   * subtree inherit it by being its children rather than each checking a session.
   */
  it("nests the signed-in guard inside the public container", () => {
    expect(index).toContain("CORE_MAIN_ROUTES_ROUTE_ID");
    expect(index).toContain("CORE_AUTHENTICATED_ROUTES_ROUTE_ID");
    expect(index).toContain("ensureAuthState");
    expect(index).toContain("canAccessAuthenticatedRoute");
    // The guard is a child of the public container, not a sibling of it.
    expect(index).toMatch(/authenticatedContainer\(container\)/);
  });

  /**
   * Idempotent, and a good neighbour: siblings are preserved, so this and
   * `withPluginRoutes` compose in either order and a dev server that
   * re-evaluates the composing module does not end up with two copies.
   */
  it("mounts under its own container, replacing any previous copy", () => {
    expect(index).toContain("siblings");
    expect(index).toMatch(/addChildren\(\[\.\.\.siblings, container\]\)/);
  });

  /** And it writes no file and reads no filesystem. */
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
   * The session check belongs to the authenticated container and to nowhere
   * else. A screen that read it again could decide something the guard did not.
   *
   * This assertion followed the screens: it used to read
   * `apps/web/src/routes/_main/_authenticated/**`, and every file it covered is
   * now in this directory.
   */
  it.each(["discovery.tsx", "files.tsx", "settings.tsx"])(
    "%s adds no session check of its own",
    name => {
      const code = codeOf(name);

      expect(code).not.toContain("ensureAuthState");
      expect(code).not.toContain("getSession");
      expect(code).not.toContain("RequireSession");
    },
  );

  /**
   * And the settings subtree states `robots` exactly once, on the frame. The
   * router merges the `head` of every matched route, so a panel inherits it by
   * saying nothing - and a panel that restated it would be a second copy to keep
   * in step.
   */
  it("states the settings robots directive once, on the frame", () => {
    expect(codeOf("settings.tsx").match(/robots/g)).toHaveLength(1);
  });
});
