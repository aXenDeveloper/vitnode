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
  (adminPath: string) =>
    definitions.find(definition => definition.admin.path === adminPath);

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

    describe("under another id strategy", () => {
      const strategyOf = (idStrategy: "bigint" | "uuid") =>
        defineContentType({
          admin: { edit: { mode: "page" } },
          fields: { title: field.text({ required: true }) },
          id: `test.${idStrategy}`,
          idStrategy,
          tableName: `test_${idStrategy}`,
        }) as AnyContentTypeDefinition;
      const uuidType = strategyOf("uuid");
      const bigintType = strategyOf("bigint");
      const UUID = "0198f6f7-d4a2-7ce1-a2ee-4f5f1f2f3a4b";

      it("reads a uuid record's edit URL as its canonical string", () => {
        expect(
          resolveContentAdminRoute(
            ["test", "uuid", UUID, "edit"],
            lookupOf(uuidType),
          ),
        ).toEqual({ action: "edit", contentTypeId: "test.uuid", itemId: UUID });
      });

      it("keeps a bigint beyond Number.MAX_SAFE_INTEGER exact", () => {
        expect(
          resolveContentAdminRoute(
            ["test", "bigint", "9007199254740993", "edit"],
            lookupOf(bigintType),
          ),
        ).toEqual({
          action: "edit",
          contentTypeId: "test.bigint",
          itemId: "9007199254740993",
        });
      });

      it.each([
        ["an uppercase uuid", ["test", "uuid", UUID.toUpperCase(), "edit"]],
        ["a number for a uuid", ["test", "uuid", "42", "edit"]],
        ["a padded bigint", ["test", "bigint", "01", "edit"]],
        [
          "a bigint out of range",
          ["test", "bigint", "9223372036854775808", "edit"],
        ],
      ])("resolves nothing for %s", (_name, slug) => {
        expect(
          resolveContentAdminRoute(slug, lookupOf(uuidType, bigintType)),
        ).toBeUndefined();
      });
    });

    it("prefers an exact content type path over a create page", () => {
      // `blog/post/create` is a legal address, so the content type that really
      // lives there keeps its own list screen.
      const literal = define("blog.post.create");

      expect(
        resolveContentAdminRoute(
          ["blog", "post", "create"],
          lookupOf(pagePost, literal),
        ),
      ).toEqual({ action: "list", contentTypeId: "blog.post.create" });
    });
  });

  // The whole point of `admin.path`: the URL is the content type's own name for
  // itself, and nothing about it can be derived from the id any more.
  describe("admin.path", () => {
    const renamed = define("blog.post", {
      create: { mode: "page" },
      edit: { mode: "page" },
      path: "blog/articles",
    });

    it("resolves the list, the create page and the edit page under it", () => {
      expect(
        resolveContentAdminRoute(["blog", "articles"], lookupOf(renamed)),
      ).toEqual({ action: "list", contentTypeId: "blog.post" });
      expect(
        resolveContentAdminRoute(
          ["blog", "articles", "create"],
          lookupOf(renamed),
        ),
      ).toEqual({ action: "create", contentTypeId: "blog.post" });
      expect(
        resolveContentAdminRoute(
          ["blog", "articles", "42", "edit"],
          lookupOf(renamed),
        ),
      ).toEqual({ action: "edit", contentTypeId: "blog.post", itemId: 42 });
    });

    it("leaves the id-derived path unrouted", () => {
      expect(
        resolveContentAdminRoute(["blog", "post"], lookupOf(renamed)),
      ).toBeUndefined();
    });
  });
});
