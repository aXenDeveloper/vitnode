// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PluginRoute } from "../../routing/types.js";

import { PluginRouteError } from "../../routing/errors.js";
import { buildPluginRouteManifest } from "../../routing/manifest.js";
import {
  assertNoHostRouteCollision,
  hostRoutePathsFromFiles,
} from "./host-routes.js";

const pathsOf = (...files: string[]): string[] =>
  hostRoutePathsFromFiles(files).map(hostRoute => hostRoute.path);

const manifestOf = (...paths: string[]): PluginRoute[] =>
  buildPluginRouteManifest([
    {
      pluginId: "@vitnode/example",
      routes: paths.map((path, index) => ({
        entry: `routes/page-${index}`,
        id: `page-${index}`,
        path,
      })),
    },
  ]);

const collisionOf = (pluginPath: string, ...files: string[]): null | string => {
  try {
    assertNoHostRouteCollision(
      manifestOf(pluginPath),
      hostRoutePathsFromFiles(files),
    );
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return null;
};

/** The thrown error itself, for the fields rather than the message. */
const errorOf = (pluginPath: string, ...files: string[]): unknown => {
  try {
    assertNoHostRouteCollision(
      manifestOf(pluginPath),
      hostRoutePathsFromFiles(files),
    );
  } catch (error) {
    return error;
  }

  return null;
};

describe("hostRoutePathsFromFiles", () => {
  it("reads a flat route file as the URL its name spells", () => {
    expect(pathsOf("login.tsx")).toEqual(["/login"]);
  });

  it("reads a dot as a path separator", () => {
    expect(pathsOf("login_.reset-password.tsx")).toEqual([
      "/login/reset-password",
    ]);
  });

  it("keeps a trailing underscore out of the URL", () => {
    // `login_` breaks the route out of the `login` layout without changing the
    // segment it contributes.
    expect(pathsOf("login_.sso.$providerId.tsx")).toEqual([
      "/login/sso/$providerId",
    ]);
  });

  it("reads nested directories as segments", () => {
    expect(pathsOf("posts/comments.tsx")).toEqual(["/posts/comments"]);
  });

  it("gives an index file the URL of the directory it sits in", () => {
    expect(pathsOf("posts/index.tsx", "index.tsx")).toEqual(["/", "/posts"]);
  });

  it("gives a `route` file the URL of its directory, because it answers it", () => {
    // A file-based route with children still renders at its own path, so
    // handing that path to a plugin would shadow it.
    expect(pathsOf("posts/route.tsx", "posts.route.tsx")).toEqual([
      "/posts",
      "/posts",
    ]);
  });

  it("claims nothing for a pathless layout", () => {
    expect(pathsOf("_main.tsx", "_main/_authenticated.tsx")).toEqual([]);
  });

  it("drops a pathless segment from the middle of a path", () => {
    expect(
      pathsOf("_main/_authenticated/settings/index.tsx", "_main/discover.tsx"),
    ).toEqual(["/discover", "/settings"]);
  });

  it("drops a route group, which contributes no segment", () => {
    expect(pathsOf("(app)/dashboard.tsx")).toEqual(["/dashboard"]);
  });

  it("keeps a splat distinguishable from a parameter", () => {
    expect(pathsOf("api/$.ts")).toEqual(["/api/$"]);
  });

  it("drops a `lazy` suffix, which says how a route loads and not where it is", () => {
    expect(pathsOf("posts.lazy.tsx")).toEqual(["/posts"]);
  });

  it("does not mistake a directory called `lazy` for that suffix", () => {
    // Dropping it would invent `/` - a URL the app does not answer - and a
    // false collision fails a build over a route file that is perfectly fine.
    expect(pathsOf("lazy/index.tsx")).toEqual(["/lazy"]);
  });

  it("skips the tree's root, which is not a URL", () => {
    expect(pathsOf("__root.tsx")).toEqual([]);
  });

  it("skips a file the router itself ignores", () => {
    expect(pathsOf("-components/button.tsx", "posts/-lib/query.ts")).toEqual(
      [],
    );
  });

  it("skips anything that is not a route file", () => {
    expect(
      pathsOf(
        "posts.tsx",
        "posts.css",
        "posts.test.tsx.snap",
        "types.d.ts",
        "README.md",
      ),
    ).toEqual(["/posts"]);
  });

  it("skips a name it does not understand rather than guessing at one", () => {
    // Being incomplete costs a missed collision, which the runtime check still
    // catches. Guessing costs a build that fails over a legal route file.
    expect(pathsOf("posts.$.$weird.tsx", "__generated.tsx")).toEqual([]);
  });

  it("orders its answer, so two machines agree", () => {
    const files = ["posts.tsx", "about.tsx", "login.tsx"];

    expect(pathsOf(...files)).toEqual(["/about", "/login", "/posts"]);
    expect(pathsOf(...[...files].reverse())).toEqual(pathsOf(...files));
  });

  it("carries the file each URL came from", () => {
    expect(hostRoutePathsFromFiles(["_main/discover.tsx"])).toEqual([
      { file: "_main/discover.tsx", path: "/discover" },
    ]);
  });
});

describe("assertNoHostRouteCollision", () => {
  it("passes when nothing overlaps", () => {
    expect(collisionOf("/example", "_main/discover.tsx")).toBeNull();
  });

  it("passes when the application has no route files at all", () => {
    expect(collisionOf("/example")).toBeNull();
  });

  it("rejects a plugin route that answers a URL the app already answers", () => {
    const message = collisionOf("/discover", "_main/discover.tsx");

    expect(message).toContain('claims "/discover"');
    expect(message).toContain("_main/discover.tsx");
  });

  it("compares by the URLs matched, not by the text of the path", () => {
    // `/users/$id` and `/users/:userId` are one route space spelled twice.
    expect(collisionOf("/users/:userId", "users.$id.tsx")).toContain(
      "Both match the same URLs",
    );
  });

  it("does not collide a static route with the dynamic one beside it", () => {
    expect(collisionOf("/users/new", "users.$id.tsx")).toBeNull();
  });

  it("does not collide a plugin route with an application splat", () => {
    // `/api/$` swallows every remaining segment and `/api/:id` swallows one, so
    // they do not match the same URLs.
    expect(collisionOf("/api/:id", "api/$.ts")).toBeNull();
  });

  it("compares case-insensitively, because a router matches that way", () => {
    expect(collisionOf("/discover", "_main/Discover.tsx")).toContain(
      "Both match the same URLs",
    );
  });
});

/**
 * The refusal as *data*, which is what lets a build tool render it and what lets
 * the diagnostics layer annotate it.
 *
 * A plain `Error` carried all of this in prose, so the only way to act on any of
 * it was to parse the sentence - and `withPluginRouteDiagnostics`, which adds the
 * manifest each side was declared in, ignores anything that is not a
 * `PluginRouteError`. So the one failure fixed by editing one of two named files
 * was the one that named only one of them.
 */
describe("what a host collision throws", () => {
  it("is a PluginRouteError, so a build tool can read the fields", () => {
    expect(errorOf("/discover", "_main/discover.tsx")).toBeInstanceOf(
      PluginRouteError,
    );
  });

  it("names the plugin, the route and the path it claimed", () => {
    const error = errorOf("/discover", "_main/discover.tsx");

    expect(error).toMatchObject({
      code: "host-route-collision",
      path: "/discover",
      pluginId: "@vitnode/example",
      routeId: "@vitnode/example:page-0",
    });
  });

  /**
   * The other side of the collision, in its own field.
   *
   * Not `conflictsWith`, which means "another plugin's route": the two are fixed
   * differently, and a caller has to be able to tell "rename one plugin's route"
   * from "edit this file".
   */
  it("names the application's own route as the conflicting owner", () => {
    const error = errorOf("/discover", "_main/discover.tsx");

    expect(error).toMatchObject({
      conflictsWithHostRoute: { file: "_main/discover.tsx", path: "/discover" },
    });
    expect((error as PluginRouteError).conflictsWith).toBeUndefined();
  });
});
