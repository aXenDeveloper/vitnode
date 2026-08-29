// @vitest-environment node
import { describe, expect, it } from "vitest";

import type {
  PluginRoute,
  PluginRouteDefinition,
} from "../../routing/types.js";

import { buildPluginRouteManifest } from "../../routing/manifest.js";
import {
  assertNoLegacyRouteCollision,
  legacyAdminRoutePathsFromFiles,
} from "./legacy-routes.js";

/**
 * The migration-only refusal that keeps `/admin/content/*` answering.
 *
 * Two halves, tested apart because they fail differently. Reading the legacy
 * route files can only ever be *incomplete* - an unrecognised name skips its own
 * file and nothing else - so most of the first half is about what it declines to
 * claim. The comparison can be wrong in the expensive direction, so the second
 * half is mostly about the catch-all, which is the one shape a match key cannot
 * express on its own.
 *
 * Pure throughout: file *names* in, decisions out, no filesystem.
 */

/** The manifest one declaration builds into, which is what the check reads. */
const manifestOf = (...routes: PluginRouteDefinition[]): PluginRoute[] =>
  buildPluginRouteManifest([{ pluginId: "@vitnode/example", routes }]);

const route = (
  path: string,
  rest: Partial<PluginRouteDefinition> = {},
): PluginRouteDefinition => ({
  entry: "routes/x",
  id: "x",
  path,
  ...rest,
});

/** What `src/routes/admin/` actually holds today, as far as this rule is concerned. */
const CORE_ADMIN_FILES = [
  "content/[...slug]/page.tsx",
  "core/page.tsx",
  "core/users/[id]/page.tsx",
  "core/users/page.tsx",
  "core/users/roles/page.tsx",
];

describe("reading the legacy AdminCP's route files", () => {
  it("claims the URL of the directory a page sits in, under /admin", () => {
    expect(legacyAdminRoutePathsFromFiles(["core/users/page.tsx"])).toEqual([
      {
        file: "src/routes/admin/core/users/page.tsx",
        key: "/admin/core/users",
        path: "/admin/core/users",
        subtree: false,
      },
    ]);
  });

  it("reads a dynamic segment into the shared key space", () => {
    expect(
      legacyAdminRoutePathsFromFiles(["core/users/[id]/page.tsx"]),
    ).toMatchObject([{ key: "/admin/core/users/:", subtree: false }]);
  });

  /**
   * The one that matters. A catch-all swallows every remaining segment, so it
   * owns a *subtree* rather than a URL - and `routeMatchKey`'s promise is that
   * equal keys mean equal sets of URLs, which no single key can keep for a
   * splat.
   */
  it.each([
    ["a required catch-all", "content/[...slug]/page.tsx"],
    ["an optional catch-all", "content/[[...slug]]/page.tsx"],
  ])("reads %s as ownership of the whole subtree", (_label, file) => {
    expect(legacyAdminRoutePathsFromFiles([file])).toMatchObject([
      { key: "/admin/content", subtree: true },
    ]);
  });

  /** A route group is a folder for the author, not a segment for the browser. */
  it("drops a route group", () => {
    expect(
      legacyAdminRoutePathsFromFiles(["(auth)/core/page.tsx"]),
    ).toMatchObject([{ key: "/admin/core" }]);
  });

  /**
   * Everything under `app/` that renders around a page rather than being one.
   * A directory holding only these answers no URL, and claiming one for it would
   * fail a build over a legacy page that is perfectly fine.
   */
  it.each(["layout.tsx", "loading.tsx", "default.tsx", "error.tsx"])(
    "claims nothing for %s",
    file => {
      expect(legacyAdminRoutePathsFromFiles([`core/${file}`])).toEqual([]);
    },
  );

  /**
   * Unknown is skipped, never guessed. `@slot` is a parallel route and
   * `_private` is a folder Next excludes from routing - neither claims the URL
   * it looks like it claims, so reading them as static segments would invent
   * one.
   */
  it.each([
    ["a parallel route slot", "core/@sidebar/page.tsx"],
    ["a private folder", "core/_components/page.tsx"],
    ["a name this reader has not been taught", "core/{weird}/page.tsx"],
    ["a declaration file", "core/page.d.ts"],
    ["something that is not a route file", "core/page.css"],
  ])("skips %s", (_label, file) => {
    expect(legacyAdminRoutePathsFromFiles([file])).toEqual([]);
  });

  it("is sorted, so a diagnostic names the same page on every machine", () => {
    expect(
      legacyAdminRoutePathsFromFiles([...CORE_ADMIN_FILES].reverse()).map(
        legacy => legacy.key,
      ),
    ).toEqual([
      "/admin/content",
      "/admin/core",
      "/admin/core/users",
      "/admin/core/users/:",
      "/admin/core/users/roles",
    ]);
  });
});

describe("refusing a plugin route that takes a legacy URL", () => {
  const legacy = legacyAdminRoutePathsFromFiles(CORE_ADMIN_FILES);
  const check = (declaration: PluginRouteDefinition) => () => {
    assertNoLegacyRouteCollision(manifestOf(declaration), legacy);
  };

  /**
   * The single most breakable thing in the stage, as one assertion.
   *
   * A TanStack route here would make `isTanStackOwnedPath` answer `true`,
   * `MigrationLink` render a client navigation, and a working Content Engine
   * screen become a not-found - with no error anywhere, because every layer did
   * exactly what it was told.
   */
  it("refuses a route inside a subtree Next.js still owns", () => {
    expect(check(route("/admin/content/blog", { area: "admin" }))).toThrow(
      /\/admin\/content.*and everything beneath it/s,
    );
  });

  it("refuses one deeper inside that subtree", () => {
    expect(
      check(route("/admin/content/blog/posts", { area: "admin" })),
    ).toThrow(/still answers/);
  });

  it("refuses the root of that subtree", () => {
    expect(check(route("/admin/content", { area: "admin" }))).toThrow(
      /still answers/,
    );
  });

  it("refuses a route at a legacy page's exact URL", () => {
    expect(check(route("/admin/core/users", { area: "admin" }))).toThrow(
      /src\/routes\/admin\/core\/users\/page\.tsx/,
    );
  });

  /** The same key space as every other collision check: `:id` is `:userId`. */
  it("refuses a dynamic route that matches a legacy dynamic one", () => {
    expect(
      check(route("/admin/core/users/:userId", { area: "admin" })),
    ).toThrow(/still answers/);
  });

  /**
   * An area chooses a shell and never a prefix, so a `main` route can spell an
   * `/admin` path just as easily - and would take the URL just as thoroughly,
   * while rendering it with the public site's header.
   */
  it("refuses it in the main area too", () => {
    expect(check(route("/admin/content/blog"))).toThrow(/still answers/);
  });

  it.each([
    ["a sibling of a legacy page", "/admin/core/reports"],
    ["a name that only starts the same", "/admin/contents"],
    ["a public page", "/reports"],
  ])("allows %s", (_label, path) => {
    expect(check(route(path, { area: "admin" }))).not.toThrow();
  });

  /**
   * The cutover, and every application that was never part of this migration:
   * no legacy routes means no check, rather than a rule that has to be
   * remembered and removed.
   */
  it("does nothing when there are no legacy routes", () => {
    expect(() => {
      assertNoLegacyRouteCollision(manifestOf(route("/admin/content")), []);
    }).not.toThrow();
  });
});
