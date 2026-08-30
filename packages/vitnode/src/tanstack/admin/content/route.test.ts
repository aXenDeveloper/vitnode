// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import { buildContentFrontendRegistry } from "@/content/admin/registry";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

import {
  contentPermissionFor,
  contentRouteSegments,
  resolveContentAdminScreen,
} from "./route";

/**
 * The splat, the resolver and the permission tuple - the three pure decisions
 * the Content Engine route makes before it fetches anything.
 *
 * `resolveContentAdminRoute` has its own suite in `content/admin/route.test.ts`
 * and is not re-tested here. What *is* tested is that this route reaches it with
 * the right arguments: the segments a splat produces, and a lookup keyed by
 * `admin.path`. Those are the two things a second slug parser would get wrong.
 */

const define = (
  id: string,
  admin: Partial<Parameters<typeof defineContentType>[0]["admin"]> = {},
): AnyContentTypeDefinition =>
  defineContentType({
    id,
    tableName: id.split(".").join("_"),
    fields: { title: field.text({ required: true }) },
    admin: { ...admin },
  }) as AnyContentTypeDefinition;

const registryOf = (...definitions: AnyContentTypeDefinition[]) =>
  buildContentFrontendRegistry([
    {
      pluginId: "@vitnode/blog",
      contentTypes: definitions.map(definition => ({ definition })),
    },
  ]);

const dialogPost = define("blog.post");
const pagePost = define("blog.post", {
  create: { mode: "page" },
  edit: { mode: "page" },
});

describe("contentRouteSegments", () => {
  it("splits the splat into path segments", () => {
    expect(contentRouteSegments("blog/articles")).toEqual(["blog", "articles"]);
  });

  it("is empty for a splat that matched nothing", () => {
    // `/admin/content` itself. `undefined` rather than `""` is what the router
    // hands over, and `[""]` would be a one-segment path that is not one.
    expect(contentRouteSegments(undefined)).toEqual([]);
    expect(contentRouteSegments("")).toEqual([]);
  });

  it("drops empty segments from a doubled or trailing slash", () => {
    expect(contentRouteSegments("blog//articles/")).toEqual([
      "blog",
      "articles",
    ]);
  });
});

describe("resolveContentAdminScreen", () => {
  it("resolves a list", () => {
    const registry = registryOf(dialogPost);

    expect(resolveContentAdminScreen(["blog", "post"], registry)).toMatchObject(
      { action: "list" },
    );
  });

  it("resolves nothing for an empty path", () => {
    // `/admin/content` has no index screen, and must not invent one.
    expect(
      resolveContentAdminScreen([], registryOf(dialogPost)),
    ).toBeUndefined();
  });

  it("resolves nothing for a content type nobody registered", () => {
    expect(
      resolveContentAdminScreen(["blog", "nope"], registryOf(dialogPost)),
    ).toBeUndefined();
  });

  /**
   * The behaviour the whole `admin.path` design exists for, checked through this
   * route rather than only through the resolver: the lookup has to be keyed by
   * the path, and a route that reached for `byId` instead would break exactly
   * the content types that renamed themselves.
   */
  describe("admin.path", () => {
    const renamed = define("blog.post", {
      create: { mode: "page" },
      edit: { mode: "page" },
      path: "blog/articles",
    });
    const registry = registryOf(renamed);

    it("resolves the renamed path to the content type", () => {
      expect(
        resolveContentAdminScreen(["blog", "articles"], registry),
      ).toMatchObject({ action: "list" });
      expect(
        resolveContentAdminScreen(["blog", "articles"], registry)?.entry
          .definition.id,
      ).toBe("blog.post");
    });

    it("leaves the id-derived path unrouted", () => {
      expect(
        resolveContentAdminScreen(["blog", "post"], registry),
      ).toBeUndefined();
    });

    it("resolves its create and edit pages", () => {
      expect(
        resolveContentAdminScreen(["blog", "articles", "create"], registry),
      ).toMatchObject({ action: "create" });
      expect(
        resolveContentAdminScreen(["blog", "articles", "42", "edit"], registry),
      ).toMatchObject({ action: "edit", itemId: 42 });
    });
  });

  describe("page mode", () => {
    it("accepts the form URLs of a page-mode content type", () => {
      const registry = registryOf(pagePost);

      expect(
        resolveContentAdminScreen(["blog", "post", "create"], registry),
      ).toMatchObject({ action: "create" });
      expect(
        resolveContentAdminScreen(["blog", "post", "7", "edit"], registry),
      ).toMatchObject({ action: "edit", itemId: 7 });
    });

    /**
     * A dialog-mode content type has no form *page*, and answering one would be
     * a second, unstyled way into the same form.
     */
    it("refuses the form URLs of a dialog-mode content type", () => {
      const registry = registryOf(dialogPost);

      expect(
        resolveContentAdminScreen(["blog", "post", "create"], registry),
      ).toBeUndefined();
      expect(
        resolveContentAdminScreen(["blog", "post", "1", "edit"], registry),
      ).toBeUndefined();
    });

    it("gates each action on its own mode", () => {
      const registry = registryOf(
        define("blog.post", { create: { mode: "page" } }),
      );

      expect(
        resolveContentAdminScreen(["blog", "post", "create"], registry),
      ).toMatchObject({ action: "create" });
      expect(
        resolveContentAdminScreen(["blog", "post", "1", "edit"], registry),
      ).toBeUndefined();
    });

    it.each([
      ["a missing identifier", ["blog", "post", "edit"]],
      ["a non-numeric identifier", ["blog", "post", "abc", "edit"]],
      ["a zero identifier", ["blog", "post", "0", "edit"]],
      ["a padded identifier", ["blog", "post", "01", "edit"]],
      ["a negative identifier", ["blog", "post", "-1", "edit"]],
      ["a fractional identifier", ["blog", "post", "1.5", "edit"]],
    ])("resolves nothing for %s", (_name, segments) => {
      expect(
        resolveContentAdminScreen(segments, registryOf(pagePost)),
      ).toBeUndefined();
    });
  });

  /**
   * `blog/post/create` is a legal address for a content type of its own, and the
   * exact match wins - so that content type keeps its list screen and the create
   * page of `blog/post` becomes unreachable. A name clash its author can see,
   * rather than a screen that silently disappeared.
   */
  it("prefers an exact content type path over a create page", () => {
    const literal = define("blog.post.create");
    const registry = registryOf(pagePost, literal);

    expect(
      resolveContentAdminScreen(["blog", "post", "create"], registry),
    ).toMatchObject({ action: "list" });
    expect(
      resolveContentAdminScreen(["blog", "post", "create"], registry)?.entry
        .definition.id,
    ).toBe("blog.post.create");
  });

  /**
   * The edit suffix cannot be shadowed the way `create` can, and the reason is
   * one level down: `admin.path` segments must start with a lowercase letter, so
   * no content type can live at `blog/post/7/edit`. The ambiguity only exists
   * for a path whose last segment is a word.
   */
  it("cannot have its edit page shadowed, because a path segment is never a number", () => {
    expect(() =>
      define("blog.post.archive", { path: "blog/post/7/edit" }),
    ).toThrow(/admin\.path "blog\/post\/7\/edit" is not a URL path/);

    expect(
      resolveContentAdminScreen(
        ["blog", "post", "7", "edit"],
        registryOf(pagePost),
      ),
    ).toMatchObject({ action: "edit", itemId: 7 });
  });
});

/**
 * The tuple the loader checks, read off the definition rather than assembled
 * from the content type id.
 *
 * `admin.permissionModule` may differ from the entity name, and a guessed module
 * checks a permission that does not exist - which grants nothing and denies
 * nothing, so the screen would open for everybody or for nobody depending on
 * which way the check falls.
 */
describe("contentPermissionFor", () => {
  it("names the plugin, the definition's module and the permission", () => {
    const registry = registryOf(dialogPost);
    const entry = registry.byId("blog.post");

    expect(entry).toBeDefined();
    expect(
      contentPermissionFor(
        entry ?? {
          definition: dialogPost,
          pluginId: "",
          registration: { definition: dialogPost },
        },
        CONTENT_PERMISSIONS.view,
      ),
    ).toEqual({
      module: dialogPost.permissionModule,
      permission: "can_view",
      plugin: "@vitnode/blog",
    });
  });

  it("reads a renamed permission module rather than deriving one", () => {
    const renamed = define("blog.post", { permissionModule: "articles" });
    const entry = registryOf(renamed).byId("blog.post");

    expect(entry?.definition.permissionModule).toBe("articles");
    expect(
      entry && contentPermissionFor(entry, CONTENT_PERMISSIONS.create).module,
    ).toBe("articles");
  });
});
