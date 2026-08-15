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
  CONTENT_EDIT_HREF_PLACEHOLDER,
  contentAdminHref,
  contentCreateHref,
  contentEditHref,
  contentEditHrefTemplate,
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

  // Two distinct ids can still land on one module: the entity key joins dotted
  // segments with `_`, and a hyphen slugs to `_` as well.
  const collidingIds = {
    dotted: { id: "test.kb.article", tableName: "test_kb_articles" },
    hyphenated: { id: "test.kb-article", tableName: "test_kb_article" },
  };

  it("rejects two content types deriving the same permission module in one plugin", () => {
    expect(() =>
      validateContentTypes([
        entry(widget(collidingIds.dotted)),
        entry(widget(collidingIds.hyphenated)),
      ]),
    ).toThrow(/Permission module "kb_article" is derived by both/);
  });

  it("allows the same permission module in different plugins", () => {
    expect(() =>
      validateContentTypes([
        entry(widget(collidingIds.dotted), "@vitnode/a"),
        entry(widget(collidingIds.hyphenated), "@vitnode/b"),
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

    expect(merged?.admin?.article).toEqual([
      "can_view",
      { dependsOn: ["can_view"], permission: "can_create" },
      { dependsOn: ["can_view"], permission: "can_edit" },
      { dependsOn: ["can_view"], permission: "can_delete" },
    ]);
  });

  it("keeps an explicitly declared module untouched", () => {
    const merged = withContentPermissions(
      { admin: { article: ["can_view"] } },
      [entry(testArticleContentType)],
    );

    expect(merged?.admin?.article).toEqual(["can_view"]);
  });

  it("leaves other modules alone", () => {
    const merged = withContentPermissions(
      { admin: { posts: ["can_view", "can_edit"] } },
      [entry(testArticleContentType)],
    );

    expect(merged?.admin?.posts).toEqual(["can_view", "can_edit"]);
    expect(merged?.admin?.article).toBeDefined();
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

  it("builds the generated form page URLs off the list one", () => {
    expect(contentCreateHref("example.article")).toBe(
      "/admin/content/example/article/create",
    );
    expect(contentEditHref("example.article", 42)).toBe(
      "/admin/content/example/article/42/edit",
    );
    expect(contentEditHrefTemplate("example.article")).toBe(
      `/admin/content/example/article/${CONTENT_EDIT_HREF_PLACEHOLDER}/edit`,
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

  it("rejects two content types in one plugin claiming the same path", () => {
    expect(() =>
      validateContentTypes([
        entry(publicWidget("test.one", "test_ones", "things")),
        entry(publicWidget("test.two", "test_twos", "things")),
      ]),
    ).toThrow(/Public path "things" is claimed by both/);
  });

  it("allows two plugins to claim the same path", () => {
    // The route is `/api/{pluginId}/content/{path}`, so these do not collide.
    // Refusing them would fail an app's boot over a name neither author can
    // see, and force one of them to rename a public URL.
    expect(() =>
      validateContentTypes([
        entry(publicWidget("first.one", "first_ones", "articles"), "@acme/one"),
        entry(
          publicWidget("second.one", "second_ones", "articles"),
          "@acme/two",
        ),
      ]),
    ).not.toThrow();
  });

  it("names both content types", () => {
    // Boot-time errors are only useful if they say where to go and what to fix.
    expect(() =>
      validateContentTypes([
        entry(publicWidget("test.one", "test_ones", "things"), "@acme/first"),
        entry(publicWidget("test.two", "test_twos", "things"), "@acme/first"),
      ]),
    ).toThrow(
      /@acme\/first -> test\.one.*@acme\/first -> test\.two|@acme\/first -> test\.two.*@acme\/first -> test\.one/,
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

/**
 * Names nobody wrote down.
 *
 * A junction or repeatable child table is generated from a field name, snake-
 * cased and clamped to Postgres' 63-character limit - so two content types can
 * reach the same physical table without either author ever typing it. Postgres
 * would not complain: the second `CREATE TABLE` simply never runs, and from then
 * on two definitions read and write one table. The same applies one level down,
 * to the `UNIQUE (itemId, position)` constraint each of them carries.
 */
describe("generated database identifiers", () => {
  const related = (
    id: string,
    tableName: string,
    fields: Parameters<typeof defineContentType>[0]["fields"],
  ) =>
    defineContentType({
      id,
      tableName,
      fields,
      admin: {
        permissionModule: tableName,
        form: { fields: Object.keys(fields) },
      },
    });

  const withRelation = (id: string, tableName: string, field_: string) =>
    related(id, tableName, {
      title: field.text({ required: true }),
      [field_]: field.relation({
        multiple: true,
        target: () => testCategoryContentType,
      }),
    });

  const withRepeatable = (id: string, tableName: string, field_: string) =>
    related(id, tableName, {
      title: field.text({ required: true }),
      [field_]: field.repeatable({
        fields: { question: field.text({ required: true }) },
      }),
    });

  it("accepts advanced content types whose generated names differ", () => {
    expect(() =>
      validateContentTypes([
        entry(withRelation("test.one", "test_ones", "tags")),
        entry(withRepeatable("test.two", "test_twos", "faq")),
      ]),
    ).not.toThrow();
  });

  it("rejects a base table that collides with another type's junction table", () => {
    // `test_ones` + `tags` generates `test_ones_tags`, which is exactly the base
    // table the second content type declares. Silently sharing it would give one
    // definition's rows two owners.
    expect(() =>
      validateContentTypes([
        entry(withRelation("test.one", "test_ones", "tags"), "@vitnode/a"),
        entry(
          related("test.two", "test_ones_tags", {
            title: field.text({ required: true }),
          }),
          "@vitnode/b",
        ),
      ]),
    ).toThrow(/Table "test_ones_tags" is claimed by both/);
  });

  it("rejects a base table that collides with another type's repeatable table", () => {
    expect(() =>
      validateContentTypes([
        entry(
          related("test.two", "test_ones_faq", {
            title: field.text({ required: true }),
          }),
          "@vitnode/b",
        ),
        entry(withRepeatable("test.one", "test_ones", "faq"), "@vitnode/a"),
      ]),
    ).toThrow(/Table "test_ones_faq" is claimed by both/);
  });

  it("names the field that generated the colliding table", () => {
    // A boot error is only useful if it says which of the two to rename, and the
    // generated side is the one that has no obvious name to look for.
    expect(() =>
      validateContentTypes([
        entry(withRelation("test.one", "test_ones", "tags"), "@vitnode/a"),
        entry(
          related("test.two", "test_ones_tags", {
            title: field.text({ required: true }),
          }),
          "@vitnode/b",
        ),
      ]),
    ).toThrow(/the junction table of "tags"/);
  });

  it("rejects two content types generating the same junction table", () => {
    // Different content types, different fields, one physical table: the
    // second's junction is named after the first's.
    expect(() =>
      validateContentTypes([
        entry(withRelation("test.one", "test_ones", "tags"), "@vitnode/a"),
        entry(
          withRelation("test.two", "test_ones_tags", "labels"),
          "@vitnode/b",
        ),
      ]),
    ).toThrow(/Table "test_ones_tags" is claimed by both/);
  });

  it("registers the generated position constraint in the index namespace", () => {
    // `test_ones` + `faq` generates `test_ones_faq_position_key`. An explicit
    // index of that name on another content type would be the same identifier
    // in the same schema, and only one of the two would exist.
    expect(() =>
      validateContentTypes([
        entry(withRepeatable("test.one", "test_ones", "faq"), "@vitnode/a"),
        entry(
          related("test.two", "test_twos", {
            title: field.text({ required: true }),
          }),
          "@vitnode/b",
        ),
      ]),
    ).not.toThrow();

    expect(() =>
      validateContentTypes([
        entry(withRepeatable("test.one", "test_ones", "faq"), "@vitnode/a"),
        entry(
          defineContentType({
            id: "test.two",
            tableName: "test_twos",
            fields: { title: field.text({ required: true }) },
            indexes: [{ name: "test_ones_faq_position_key", on: ["title"] }],
            admin: {
              permissionModule: "test_twos",
            },
          }),
          "@vitnode/b",
        ),
      ]),
    ).toThrow(/Index name "test_ones_faq_position_key" is used by both/);
  });

  it("registers a junction's primary key and target index too", () => {
    for (const name of [
      "test_ones_tags_pk",
      "test_ones_tags_related_item_id_idx",
    ]) {
      expect(() =>
        validateContentTypes([
          entry(withRelation("test.one", "test_ones", "tags"), "@vitnode/a"),
          entry(
            defineContentType({
              id: "test.two",
              tableName: "test_twos",
              fields: { title: field.text({ required: true }) },
              indexes: [{ name, on: ["title"] }],
              admin: {
                permissionModule: "test_twos",
              },
            }),
            "@vitnode/b",
          ),
        ]),
      ).toThrow(new RegExp(`Index name "${name}" is used by both`));
    }
  });

  it("keeps two long generated table names apart by their fingerprint", () => {
    // The clamp is what makes a collision reachable at all; the fingerprint is
    // what makes it vanishingly unlikely. Both names fill the limit exactly and
    // still differ, so the pair boots.
    const base = `t_${"a".repeat(56)}`;
    const first = withRepeatable("test.long1", `${base}_x`, "faq");
    const second = withRepeatable("test.long2", `${base}_y`, "faq");

    const [firstTable, secondTable] = [first, second].map(
      definition => definition.advanced.repeatables[0].tableName,
    );

    expect(firstTable).toHaveLength(63);
    expect(secondTable).toHaveLength(63);
    expect(firstTable).not.toBe(secondTable);
    expect(() =>
      validateContentTypes([
        entry(first, "@vitnode/a"),
        entry(second, "@vitnode/b"),
      ]),
    ).not.toThrow();
  });
});

/**
 * Delivery paths are a **site-wide** namespace, unlike the API paths above.
 *
 * The asymmetry is the whole of this block. A generated API route is
 * `/api/{pluginId}/content/{path}`, so two plugins publishing `articles` do not
 * collide and Stage 1-7 deliberately allows it. A canonical delivery URL is
 * `/articles/{slug}` with no plugin id in it at all, so the same pair really would
 * give one public URL two owners: two resolvers claiming it, two sitemaps listing it,
 * and one slug reservation table with no way to say whose a retired address was.
 */
describe("delivery paths", () => {
  const deliveryWidget = (
    id: string,
    tableName: string,
    path: string,
    { delivery = true }: { delivery?: boolean } = {},
  ) =>
    defineContentType({
      id,
      tableName,
      fields: {
        title: field.text({ required: true }),
        slug: field.slug({ source: "title" }),
      },
      publication: { enabled: true },
      publicApi: {
        enabled: true,
        path,
        fields: ["id", "title", "slug"],
      },
      ...(delivery ? { delivery: { enabled: true } } : {}),
      admin: {
        // Distinct, so the permission-module check does not fire first and mask the
        // one this block is about.
        permissionModule: tableName,
      },
    });

  it("still lets two plugins share a path when neither has delivery", () => {
    // The Stage 1-7 promise, restated here so a future delivery change cannot
    // quietly turn the API namespace into a global one.
    expect(() =>
      validateContentTypes([
        entry(
          deliveryWidget("first.one", "first_ones", "articles", {
            delivery: false,
          }),
          "@acme/one",
        ),
        entry(
          deliveryWidget("second.one", "second_ones", "articles", {
            delivery: false,
          }),
          "@acme/two",
        ),
      ]),
    ).not.toThrow();
  });

  it("rejects two plugins claiming the same delivery path", () => {
    expect(() =>
      validateContentTypes([
        entry(
          deliveryWidget("blog.article", "blog_articles", "articles"),
          "@acme/blog",
        ),
        entry(
          deliveryWidget("news.article", "news_articles", "articles"),
          "@acme/news",
        ),
      ]),
    ).toThrow(ContentEngineError);
  });

  it("names both conflicting owners", () => {
    expect(() =>
      validateContentTypes([
        entry(
          deliveryWidget("blog.article", "blog_articles", "articles"),
          "@acme/blog",
        ),
        entry(
          deliveryWidget("news.article", "news_articles", "articles"),
          "@acme/news",
        ),
      ]),
    ).toThrow(
      /Delivery path "articles" is claimed by both @acme\/blog -> blog\.article and @acme\/news -> news\.article/,
    );
  });

  it("says why the namespace is global", () => {
    expect(() =>
      validateContentTypes([
        entry(
          deliveryWidget("blog.article", "blog_articles", "articles"),
          "@acme/blog",
        ),
        entry(
          deliveryWidget("news.article", "news_articles", "articles"),
          "@acme/news",
        ),
      ]),
    ).toThrow(/site-wide public namespaces and must be globally unique/);
  });

  it("accepts different delivery paths across plugins", () => {
    expect(() =>
      validateContentTypes([
        entry(
          deliveryWidget("blog.article", "blog_articles", "articles"),
          "@acme/blog",
        ),
        entry(
          deliveryWidget("news.article", "news_articles", "news"),
          "@acme/news",
        ),
      ]),
    ).not.toThrow();
  });

  it("rejects two content types in one plugin claiming one delivery path", () => {
    // The per-plugin API check fires first here, which is correct - both rules are
    // violated, and the one that names the narrower fix wins.
    expect(() =>
      validateContentTypes([
        entry(
          deliveryWidget("blog.article", "blog_articles", "articles"),
          "@acme/blog",
        ),
        entry(
          deliveryWidget("blog.news", "blog_news", "articles"),
          "@acme/blog",
        ),
      ]),
    ).toThrow(ContentEngineError);
  });

  it("does not let a non-delivery route reserve the site namespace", () => {
    // A plugin whose `articles` route has no delivery claims nothing site-wide, so a
    // delivery-enabled `articles` elsewhere is still free to take it.
    expect(() =>
      validateContentTypes([
        entry(
          deliveryWidget("plain.one", "plain_ones", "articles", {
            delivery: false,
          }),
          "@acme/plain",
        ),
        entry(
          deliveryWidget("blog.article", "blog_articles", "articles"),
          "@acme/blog",
        ),
      ]),
    ).not.toThrow();
  });

  it("rejects the mixed case whichever order the two arrive in", () => {
    const delivered = () =>
      entry(
        deliveryWidget("blog.article", "blog_articles", "articles"),
        "@acme/blog",
      );
    const other = () =>
      entry(
        deliveryWidget("news.article", "news_articles", "articles"),
        "@acme/news",
      );

    expect(() => validateContentTypes([delivered(), other()])).toThrow(
      ContentEngineError,
    );
    expect(() => validateContentTypes([other(), delivered()])).toThrow(
      ContentEngineError,
    );
  });

  it("leaves one delivery-enabled content type alone", () => {
    expect(() =>
      validateContentTypes([
        entry(
          deliveryWidget("blog.article", "blog_articles", "articles"),
          "@acme/blog",
        ),
      ]),
    ).not.toThrow();
  });
});
