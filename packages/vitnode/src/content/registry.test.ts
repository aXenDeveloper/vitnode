// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { RegisteredContentType } from "./registry";

import { defineContentType } from "./define";
import { ContentEngineError } from "./errors";
import { field } from "./fields";
import {
  contentAdminHref,
  contentTypeToPath,
  findContentTypeById,
  orderableColumns,
  pathToContentTypeId,
  validateContentTypes,
  withContentPermissions,
} from "./registry";

// `widget()` below builds definitions through `Partial<Parameters<...>>`, which
// erases the inferred field map down to the bare constraint. Real call sites
// keep their concrete map, so this widening only exists for the test helper.
const entry = (
  definition: RegisteredContentType["definition"] | ReturnType<typeof widget>,
  pluginId = "@vitnode/example",
): RegisteredContentType => ({
  definition: definition as RegisteredContentType["definition"],
  pluginId,
});

const widget = (
  overrides: Partial<Parameters<typeof defineContentType>[0]> = {},
) =>
  defineContentType({
    id: "test.widget",
    tableName: "test_widgets",
    fields: { title: field.text({ required: true }) },
    admin: { label: { plural: "Widgets", singular: "Widget" } },
    ...overrides,
  });

describe("validateContentTypes", () => {
  it("accepts distinct content types", () => {
    expect(() =>
      validateContentTypes([
        entry(testArticleContentType),
        entry(testCategoryContentType),
      ]),
    ).not.toThrow();
  });

  it("returns entries sorted by id, whatever the registration order", () => {
    const sorted = validateContentTypes([
      entry(testArticleContentType),
      entry(testCategoryContentType),
    ]);

    expect(sorted.map(item => item.definition.id)).toEqual([
      "test.article",
      "test.category",
    ]);
  });

  it("rejects a duplicate content type id and names both plugins", () => {
    expect(() =>
      validateContentTypes([
        entry(widget(), "@vitnode/a"),
        entry(widget({ tableName: "test_widgets_two" }), "@vitnode/b"),
      ]),
    ).toThrow(/@vitnode\/a .* @vitnode\/b/);
  });

  it("rejects a duplicate table name across plugins", () => {
    expect(() =>
      validateContentTypes([
        entry(widget(), "@vitnode/a"),
        entry(widget({ id: "test.other" }), "@vitnode/b"),
      ]),
    ).toThrow(/Table "test_widgets" is claimed by both/);
  });

  it("rejects two content types deriving the same permission module in one plugin", () => {
    expect(() =>
      validateContentTypes([
        entry(widget()),
        entry(widget({ id: "test.other", tableName: "test_others" })),
      ]),
    ).toThrow(/Permission module "widgets" is derived by both/);
  });

  it("allows the same permission module in different plugins", () => {
    expect(() =>
      validateContentTypes([
        entry(widget(), "@vitnode/a"),
        entry(
          widget({ id: "test.other", tableName: "test_others" }),
          "@vitnode/b",
        ),
      ]),
    ).not.toThrow();
  });

  it.each(["cursor", "first", "last", "order", "orderBy", "search"])(
    "rejects a field named %s, which would shadow a pagination parameter",
    name => {
      expect(() =>
        validateContentTypes([
          entry(widget({ fields: { [name]: field.text({ required: true }) } })),
        ]),
      ).toThrow(ContentEngineError);
    },
  );
});

describe("withContentPermissions", () => {
  it("derives the four permissions per content type", () => {
    const merged = withContentPermissions({}, [entry(testArticleContentType)]);

    expect(merged?.admin?.test_articles).toEqual([
      "can_view",
      { dependsOn: ["can_view"], permission: "can_create" },
      { dependsOn: ["can_view"], permission: "can_edit" },
      { dependsOn: ["can_view"], permission: "can_delete" },
    ]);
  });

  it("keeps an explicitly declared module untouched", () => {
    const merged = withContentPermissions(
      { admin: { test_articles: ["can_view"] } },
      [entry(testArticleContentType)],
    );

    expect(merged?.admin?.test_articles).toEqual(["can_view"]);
  });

  it("leaves other modules alone", () => {
    const merged = withContentPermissions(
      { admin: { posts: ["can_view", "can_edit"] } },
      [entry(testArticleContentType)],
    );

    expect(merged?.admin?.posts).toEqual(["can_view", "can_edit"]);
    expect(merged?.admin?.test_articles).toBeDefined();
  });

  it("passes the config through untouched when there are no content types", () => {
    const permissionStaff = { admin: { posts: ["can_view"] } };

    expect(withContentPermissions(permissionStaff, [])).toBe(permissionStaff);
  });
});

describe("routing helpers", () => {
  it("maps a content type id onto the catch-all path", () => {
    expect(contentTypeToPath("example.article")).toBe("example/article");
    expect(contentAdminHref("example.article")).toBe(
      "/admin/content/example/article",
    );
  });

  it("round-trips the catch-all slug", () => {
    expect(pathToContentTypeId(["example", "article"])).toBe("example.article");
  });

  it("finds a registered content type by id", () => {
    const entries = validateContentTypes([entry(testArticleContentType)]);

    expect(findContentTypeById(entries, "test.article")?.pluginId).toBe(
      "@vitnode/example",
    );
    expect(findContentTypeById(entries, "test.nope")).toBeUndefined();
  });
});

describe("orderableColumns", () => {
  it("combines the declared allowlist with the system columns", () => {
    expect(orderableColumns(testArticleContentType)).toEqual([
      "title",
      "status",
      "id",
      "createdAt",
      "updatedAt",
    ]);
  });
});
