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
