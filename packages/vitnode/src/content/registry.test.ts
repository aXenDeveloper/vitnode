// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
  testPostContentType,
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
  publicOrderableColumns,
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

// Postgres index names live in the schema, not in the table, so two content
// types sharing one is a migration that fails halfway through - long after
// `defineContentType` has had its say.
describe("global index names", () => {
  const other = (
    overrides: Partial<Parameters<typeof defineContentType>[0]> = {},
  ) =>
    widget({
      id: "test.other",
      tableName: "test_others",
      admin: { label: { plural: "Others", singular: "Other" } },
      ...overrides,
    });

  /** Every index name a definition resolved to. */
  const namesOf = (definition: ReturnType<typeof widget>) =>
    definition.indexes.map(index => index.name);

  it("accepts two content types whose index names differ", () => {
    expect(() =>
      validateContentTypes([entry(widget()), entry(other())]),
    ).not.toThrow();
  });

  it("does not collide on generated names, because the table name is in them", () => {
    const [first, second] = [widget(), other()];

    expect(namesOf(first)).toContain("test_widgets_created_at_idx");
    expect(namesOf(second)).toContain("test_others_created_at_idx");
    expect(
      namesOf(first).filter(name => namesOf(second).includes(name)),
    ).toEqual([]);
  });

  it("rejects the same explicit index name inside one plugin", () => {
    expect(() =>
      validateContentTypes([
        entry(
          widget({ indexes: [{ name: "shared_title_idx", on: ["title"] }] }),
        ),
        entry(
          other({ indexes: [{ name: "shared_title_idx", on: ["title"] }] }),
        ),
      ]),
    ).toThrow(/Index name "shared_title_idx" is used by both/);
  });

  it("rejects the same explicit index name across plugins", () => {
    expect(() =>
      validateContentTypes([
        entry(
          widget({ indexes: [{ name: "shared_title_idx", on: ["title"] }] }),
          "@vitnode/a",
        ),
        entry(
          other({ indexes: [{ name: "shared_title_idx", on: ["title"] }] }),
          "@vitnode/b",
        ),
      ]),
    ).toThrow(/Index name "shared_title_idx" is used by both/);
  });

  it("names both owners, with their plugin, content type and table", () => {
    expect(() =>
      validateContentTypes([
        entry(
          widget({ indexes: [{ name: "shared_title_idx", on: ["title"] }] }),
          "@vitnode/a",
        ),
        entry(
          other({ indexes: [{ name: "shared_title_idx", on: ["title"] }] }),
          "@vitnode/b",
        ),
      ]),
    ).toThrow(
      '@vitnode/a -> test.widget (table "test_widgets", columns [title]) and @vitnode/b -> test.other (table "test_others", columns [title])',
    );
  });

  it("fails on the duplicate content type first, not on its identical indexes", () => {
    expect(() =>
      validateContentTypes([
        entry(widget(), "@vitnode/a"),
        entry(widget({ tableName: "test_widgets_two" }), "@vitnode/b"),
      ]),
    ).toThrow(/Duplicate content type id/);
  });

  // Two table names this long share every character a truncated index name can
  // keep, so only the fingerprint of the full name tells them apart.
  it("keeps shortened generated names distinct when the long originals differ", () => {
    const base = `t_${"a".repeat(56)}`;
    const first = other({ id: "test.long1", tableName: `${base}_x` });
    const second = other({ id: "test.long2", tableName: `${base}_y` });

    const [firstName, secondName] = [first, second].map(
      definition =>
        definition.indexes.find(index => index.on[0] === "createdAt")?.name,
    );

    expect(firstName).not.toBe(secondName);
    expect(firstName).toHaveLength(63);
    expect(secondName).toHaveLength(63);
    expect(() =>
      validateContentTypes([
        entry(first, "@vitnode/a"),
        entry(second, "@vitnode/b"),
      ]),
    ).not.toThrow();
  });
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

describe("publicOrderableColumns", () => {
  it("is the public allowlist, not the admin one", () => {
    // The admin list can order by `title` *and* the system columns; the public
    // one must not, or an anonymous request could sort by a hidden column.
    expect(publicOrderableColumns(testPostContentType)).toEqual([
      "publishedAt",
      "title",
    ]);
    expect(publicOrderableColumns(testPostContentType)).not.toContain(
      "createdAt",
    );
  });

  it("is empty for a content type with no public API", () => {
    expect(publicOrderableColumns(testArticleContentType)).toEqual([]);
  });
});

describe("public paths", () => {
  const publicWidget = (id: string, tableName: string, path: string) =>
    defineContentType({
      id,
      tableName,
      fields: {
        title: field.text({ required: true }),
        slug: field.slug({ source: "title" }),
      },
      publication: { enabled: true },
      publicApi: { enabled: true, path, fields: ["title", "slug"] },
      admin: {
        label: { plural: "Widgets", singular: "Widget" },
        // Distinct, so the permission-module check does not fire first and mask
        // the one this block is about.
        permissionModule: tableName,
      },
    });

  it("accepts distinct paths", () => {
    expect(() =>
      validateContentTypes([
        entry(publicWidget("test.one", "test_ones", "ones")),
        entry(publicWidget("test.two", "test_twos", "twos")),
      ]),
    ).not.toThrow();
  });

  it("rejects two content types claiming the same path", () => {
    expect(() =>
      validateContentTypes([
        entry(publicWidget("test.one", "test_ones", "things")),
        entry(publicWidget("test.two", "test_twos", "things")),
      ]),
    ).toThrow(/Public path "things" is claimed by both/);
  });

  it("names both plugins and both content types", () => {
    // Boot-time errors are only useful if they say where to go and what to fix.
    expect(() =>
      validateContentTypes([
        entry(publicWidget("test.one", "test_ones", "things"), "@acme/first"),
        entry(publicWidget("test.two", "test_twos", "things"), "@acme/second"),
      ]),
    ).toThrow(
      /@acme\/first -> test\.one.*@acme\/second -> test\.two|@acme\/second -> test\.two.*@acme\/first -> test\.one/,
    );
  });

  it("ignores content types with no public API", () => {
    expect(() =>
      validateContentTypes([
        entry(testArticleContentType),
        entry(testCategoryContentType),
      ]),
    ).not.toThrow();
  });
});
