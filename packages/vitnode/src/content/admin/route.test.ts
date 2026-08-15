// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "../types";

import { defineContentType } from "../define";
import { field } from "../fields";
import { resolveContentAdminRoute } from "./route";

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

const dialogPost = define("blog.post");
const pagePost = define("blog.post", {
  create: { mode: "page" },
  edit: { mode: "page" },
});
const createOnly = define("blog.post", { create: { mode: "page" } });

const lookupOf =
  (...definitions: AnyContentTypeDefinition[]) =>
  (id: string) =>
    definitions.find(definition => definition.id === id);

describe("resolveContentAdminRoute", () => {
  it("resolves the list of a registered content type", () => {
    expect(
      resolveContentAdminRoute(["blog", "post"], lookupOf(dialogPost)),
    ).toEqual({ action: "list", contentTypeId: "blog.post" });
  });

  it("resolves nothing for an unknown content type", () => {
    expect(
      resolveContentAdminRoute(["blog", "nope"], lookupOf(dialogPost)),
    ).toBeUndefined();
  });

  it("resolves nothing for an empty slug", () => {
    expect(resolveContentAdminRoute([], lookupOf(dialogPost))).toBeUndefined();
  });

  describe("page mode", () => {
    it("resolves the create page", () => {
      expect(
        resolveContentAdminRoute(
          ["blog", "post", "create"],
          lookupOf(pagePost),
        ),
      ).toEqual({ action: "create", contentTypeId: "blog.post" });
    });

    it("resolves the edit page", () => {
      expect(
        resolveContentAdminRoute(
          ["blog", "post", "42", "edit"],
          lookupOf(pagePost),
        ),
      ).toEqual({ action: "edit", contentTypeId: "blog.post", itemId: 42 });
    });

    it("refuses a form URL of a dialog-mode content type", () => {
      expect(
        resolveContentAdminRoute(
          ["blog", "post", "create"],
          lookupOf(dialogPost),
        ),
      ).toBeUndefined();
      expect(
        resolveContentAdminRoute(
          ["blog", "post", "1", "edit"],
          lookupOf(dialogPost),
        ),
      ).toBeUndefined();
    });

    it("gates each action on its own mode", () => {
      expect(
        resolveContentAdminRoute(
          ["blog", "post", "create"],
          lookupOf(createOnly),
        ),
      ).toEqual({ action: "create", contentTypeId: "blog.post" });
      expect(
        resolveContentAdminRoute(
          ["blog", "post", "1", "edit"],
          lookupOf(createOnly),
        ),
      ).toBeUndefined();
    });

    it.each([
      ["a missing identifier", ["blog", "post", "edit"]],
      ["a non-numeric identifier", ["blog", "post", "abc", "edit"]],
      ["a zero identifier", ["blog", "post", "0", "edit"]],
      ["a padded identifier", ["blog", "post", "01", "edit"]],
      ["a negative identifier", ["blog", "post", "-1", "edit"]],
      ["a fractional identifier", ["blog", "post", "1.5", "edit"]],
    ])("resolves nothing for %s", (_name, slug) => {
      expect(
        resolveContentAdminRoute(slug, lookupOf(pagePost)),
      ).toBeUndefined();
    });

    it("prefers an exact content type id over a create page", () => {
      // `blog.post.create` is a legal id, so the content type that really is
      // called that keeps its own list screen.
      const literal = define("blog.post.create");

      expect(
        resolveContentAdminRoute(
          ["blog", "post", "create"],
          lookupOf(pagePost, literal),
        ),
      ).toEqual({ action: "list", contentTypeId: "blog.post.create" });
    });
  });
});
