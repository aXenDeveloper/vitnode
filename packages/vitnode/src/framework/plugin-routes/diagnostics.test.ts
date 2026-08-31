// @vitest-environment node
import { describe, expect, it } from "vitest";

import { PluginRouteError } from "../../routing/errors.js";
import {
  annotatePluginRouteError,
  PLUGIN_ROUTES_ERROR_PREFIX,
  withPluginRouteDiagnostics,
} from "./diagnostics.js";

const specifiers = new Map([
  ["@vitnode/blog", "@vitnode/blog/routes/manifest"],
  ["@vitnode/example", "@vitnode/example/routes/manifest"],
]);

const annotated = (error: unknown): unknown =>
  annotatePluginRouteError(error, specifiers);

describe("annotatePluginRouteError", () => {
  it("names the manifest the route was declared in", () => {
    const message = annotated(
      new PluginRouteError('Plugin route "x" has an invalid path.', {
        code: "invalid-path",
        pluginId: "@vitnode/example",
        routeId: "x",
      }),
    );

    expect(String(message)).toContain(
      'Declared in "@vitnode/example/routes/manifest".',
    );
    expect(String(message)).toContain(PLUGIN_ROUTES_ERROR_PREFIX);
  });

  it("names the other side's manifest on a collision", () => {
    // The half of a collision `@vitnode/core/routing` cannot know: which file
    // the route that got there first was declared in.
    expect(
      String(
        annotated(
          new PluginRouteError("Plugin route path collision.", {
            code: "duplicate-path",
            conflictsWith: {
              pluginId: "@vitnode/blog",
              routeId: "@vitnode/blog:post",
            },
            pluginId: "@vitnode/example",
            routeId: "post",
          }),
        ),
      ),
    ).toContain(
      'The route it conflicts with, "@vitnode/blog:post", is declared in "@vitnode/blog/routes/manifest".',
    );
  });

  it("keeps the structured fields a build tool renders itself", () => {
    const error = annotated(
      new PluginRouteError("Nope.", {
        code: "duplicate-id",
        path: "/x",
        pluginId: "@vitnode/example",
        routeId: "x",
      }),
    );

    expect(error).toBeInstanceOf(PluginRouteError);
    expect(error).toMatchObject({
      code: "duplicate-id",
      path: "/x",
      pluginId: "@vitnode/example",
      routeId: "x",
    });
  });

  it("says nothing about a plugin whose manifest it does not know", () => {
    expect(
      String(
        annotated(
          new PluginRouteError("Nope.", {
            code: "invalid-plugin-id",
            pluginId: "",
          }),
        ),
      ),
    ).toBe(`PluginRouteError: ${PLUGIN_ROUTES_ERROR_PREFIX} Nope.`);
  });

  it("leaves an error that is not a route error alone", () => {
    const error = new Error("something else entirely");

    expect(annotated(error)).toBe(error);
  });
});

describe("withPluginRouteDiagnostics", () => {
  it("returns what the step returned", () => {
    expect(withPluginRouteDiagnostics(specifiers, () => 41 + 1)).toBe(42);
  });

  it("annotates whatever the step threw", () => {
    expect(() =>
      withPluginRouteDiagnostics(specifiers, () => {
        throw new PluginRouteError("Nope.", {
          code: "invalid-path",
          pluginId: "@vitnode/blog",
          routeId: "post",
        });
      }),
    ).toThrow('Declared in "@vitnode/blog/routes/manifest".');
  });
});
