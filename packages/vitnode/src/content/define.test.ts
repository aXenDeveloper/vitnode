// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { ContentUserField } from "./types";

import {
  CONTENT_PREVIEW_DEFAULT_TTL_MINUTES,
  CONTENT_REVISION_DEFAULT_RETENTION,
  CONTENT_REVISION_MAX_RETENTION,
  CONTENT_REVISION_MIN_RETENTION,
} from "./const";
import { defineContentType } from "./define";
import { ContentEngineError } from "./errors";
import { field } from "./fields";

const define = (
  overrides: Partial<Parameters<typeof defineContentType>[0]> = {},
) =>
  defineContentType({
    id: "test.widget",
    tableName: "test_widgets",
    fields: { title: field.text({ required: true }) },
    ...overrides,
  });

describe("defineContentType", () => {
  describe("identifiers", () => {
    it.each([
      ["Article", "not dotted or lowercase"],
      ["example.", "trailing dot"],
      ["example.Article", "uppercase segment"],
      ["example_article", "underscore instead of dot"],
    ])("rejects the id %s (%s)", id => {
      expect(() => define({ id })).toThrow(ContentEngineError);
    });

    it("accepts a dotted lowercase id", () => {
      expect(define({ id: "example.knowledge-article" }).id).toBe(
        "example.knowledge-article",
      );
    });

    it.each(["Test_Widgets", "1widgets", "test-widgets"])(
      "rejects the table name %s",
      tableName => {
        expect(() => define({ tableName })).toThrow(ContentEngineError);
      },
    );

    it("rejects a table name past the Postgres identifier limit", () => {
      expect(() => define({ tableName: "a".repeat(64) })).toThrow(
        /identifier limit/,
      );
    });
  });

  describe("fields", () => {
    it.each(["id", "createdAt", "updatedAt"])(
      "rejects the reserved field name %s",
      name => {
        expect(() =>
          define({ fields: { [name]: field.text({ required: true }) } }),
        ).toThrow(/reserved system column/);
      },
    );

    it("rejects a field name that is not camelCase", () => {
      expect(() =>
        define({ fields: { Title: field.text({ required: true }) } }),
      ).toThrow(/camelCase/);
    });

    it("rejects a content type with no fields", () => {
      expect(() => define({ fields: {} })).toThrow(/at least one field/);
    });

    it("rejects a field that is neither required, nullable, nor defaulted", () => {
      expect(() => define({ fields: { title: field.text() } })).toThrow(
        /needs a default value/,
      );
    });

    it("accepts a defaulted field that is neither required nor nullable", () => {
      expect(() =>
        define({
          fields: { views: field.number({ integer: true, defaultValue: 0 }) },
        }),
      ).not.toThrow();
    });

    it("accepts a dateTime with defaultNow instead of a default value", () => {
      expect(() =>
        define({ fields: { seenAt: field.dateTime({ defaultNow: true }) } }),
      ).not.toThrow();
    });

    it("rejects minLength greater than maxLength", () => {
      expect(() =>
        define({
          fields: {
            title: field.text({ required: true, minLength: 10, maxLength: 5 }),
          },
        }),
      ).toThrow(/minLength 10 greater than maxLength 5/);
    });

    it("rejects min greater than max", () => {
      expect(() =>
        define({
          fields: {
            views: field.number({
              required: true,
              integer: true,
              min: 10,
              max: 1,
            }),
          },
        }),
      ).toThrow(/min 10 greater than max 1/);
    });

    it("rejects duplicate enum values", () => {
      expect(() =>
        define({
          fields: {
            status: field.enum({ required: true, values: ["a", "b", "a"] }),
          },
        }),
      ).toThrow(/duplicate enum values/);
    });

    it("rejects an enum default that is not one of its values", () => {
      expect(() =>
        define({
          fields: {
            // The type already rules this out; the runtime guard covers plain
            // JS consumers and `as` escapes.
            // @ts-expect-error - "nope" is not in `values`
            status: field.enum({ values: ["draft"], defaultValue: "nope" }),
          },
        }),
      ).toThrow(/not one of its values/);
    });

    it("rejects an enum value longer than the column length", () => {
      expect(() =>
        define({
          fields: {
            status: field.enum({
              required: true,
              length: 4,
              values: ["draft", "ok"],
            }),
          },
        }),
      ).toThrow(/longer than the column length 4/);
    });
  });

  // `ON DELETE SET NULL` on a NOT NULL column is accepted by Postgres at
  // CREATE TABLE time and only blows up years later, when someone finally
  // deletes a referenced row.
  describe("reference onDelete", () => {
    const withField = (fieldValue: ContentUserField) =>
      define({ fields: { owner: fieldValue } });

    it("rejects a non-nullable user field with `set null`", () => {
      expect(() =>
        withField(
          field.user({ nullable: false, onDelete: "set null", required: true }),
        ),
      ).toThrow(/not nullable/);
    });

    it("rejects a non-nullable relation with `set null`", () => {
      expect(() =>
        define({
          fields: {
            category: field.relation({
              nullable: false,
              onDelete: "set null",
              required: true,
              target: () => testCategoryContentType,
            }),
          },
        }),
      ).toThrow(/not nullable/);
    });

    it("names the field and the content type in the message", () => {
      expect(() =>
        withField(
          field.user({ nullable: false, onDelete: "set null", required: true }),
        ),
      ).toThrow(/test\.widget: Field "owner"/);
    });

    it("accepts a nullable user field with `set null`", () => {
      expect(() =>
        withField(field.user({ nullable: true, onDelete: "set null" })),
      ).not.toThrow();
    });

    it("accepts a nullable relation with `set null`", () => {
      expect(() =>
        define({
          fields: {
            category: field.relation({
              nullable: true,
              onDelete: "set null",
              target: () => testCategoryContentType,
            }),
          },
        }),
      ).not.toThrow();
    });

    it.each(["cascade", "restrict"] as const)(
      "accepts a non-nullable relation with %s",
      onDelete => {
        expect(() =>
          define({
            fields: {
              category: field.relation({
                onDelete,
                required: true,
                target: () => testCategoryContentType,
              }),
            },
          }),
        ).not.toThrow();
      },
    );

    describe("defaults", () => {
      it("makes a bare user field nullable with `set null`", () => {
        const owner = withField(field.user()).fields.owner;

        expect(owner).toMatchObject({ nullable: true, onDelete: "set null" });
      });

      it("falls back to `restrict` when the user field is not nullable", () => {
        const owner = withField(field.user({ nullable: false, required: true }))
          .fields.owner;

        expect(owner).toMatchObject({ nullable: false, onDelete: "restrict" });
      });

      it("defaults a relation to `restrict`", () => {
        const definition = define({
          fields: {
            category: field.relation({
              required: true,
              target: () => testCategoryContentType,
            }),
          },
        });

        expect(definition.fields.category).toMatchObject({
          nullable: false,
          onDelete: "restrict",
        });
      });
    });
  });

  describe("slug fields", () => {
    const defineSlug = (slugField: unknown, extra: object = {}) =>
      define({
        fields: {
          title: field.text({ required: true }),
          views: field.number({ integer: true, defaultValue: 0 }),
          body: field.textarea({ nullable: true }),
          ...extra,
          slug: slugField as ReturnType<typeof field.slug>,
        },
      });

    it("accepts a source that names a text field", () => {
      expect(
        defineSlug(field.slug({ source: "title" })).fields.slug,
      ).toMatchObject({ kind: "slug", nullable: false, source: "title" });
    });

    it("accepts no source at all", () => {
      expect(defineSlug(field.slug()).fields.slug).toMatchObject({
        required: true,
        source: undefined,
      });
    });

    it("is optional in the create payload once it has a source", () => {
      // The engine can always derive it, so demanding it from the caller would
      // be busywork - which is why `field.slug` has no `required` argument.
      expect(
        defineSlug(field.slug({ source: "title" })).fields.slug,
      ).toMatchObject({ required: false });
    });

    it("rejects a source that does not exist", () => {
      expect(() => defineSlug(field.slug({ source: "nope" }))).toThrow(
        /sourced from "nope", which is not a field/,
      );
    });

    it.each([
      ["views", "number"],
      ["body", "textarea"],
    ])("rejects the non-text source %s", source => {
      expect(() => defineSlug(field.slug({ source }))).toThrow(
        /can only be derived from a text field/,
      );
    });

    it("rejects a source pointing at another slug", () => {
      expect(() =>
        defineSlug(field.slug({ source: "permalink" }), {
          permalink: field.slug(),
        }),
      ).toThrow(/can only be derived from a text field/);
    });

    it("rejects a non-positive maxLength", () => {
      expect(() =>
        defineSlug(field.slug({ maxLength: 0, source: "title" })),
      ).toThrow(/must be positive/);
    });

    it("gets a unique index automatically", () => {
      expect(
        defineSlug(field.slug({ source: "title" })).indexes,
      ).toContainEqual({
        name: "test_widgets_slug_key",
        on: ["slug"],
        unique: true,
      });
    });

    it("is not searchable by default", () => {
      expect(
        defineSlug(field.slug({ source: "title" })).admin.list.searchableFields,
      ).toEqual(["title", "body"]);
    });

    it("can be searched when asked for explicitly", () => {
      expect(
        define({
          fields: {
            title: field.text({ required: true }),
            slug: field.slug({ source: "title" }),
          },
          admin: { list: { searchableFields: ["title", "slug"] } },
        }).admin.list.searchableFields,
      ).toEqual(["title", "slug"]);
    });

    it("is never picked as the default title field", () => {
      // A URL segment is a poor thing to show in a toast or a relation picker.
      expect(
        define({
          fields: {
            slug: field.slug(),
            title: field.text({ required: true }),
          },
        }).admin.titleField,
      ).toBe("title");
    });

    it("can be the title field when asked for explicitly", () => {
      expect(
        define({
          fields: {
            title: field.text({ required: true }),
            slug: field.slug({ source: "title" }),
          },
          admin: { titleField: "slug" },
        }).admin.titleField,
      ).toBe("slug");
    });
  });

  describe("indexes", () => {
    it("expands the automatic indexes onto the definition", () => {
      expect(
        define({
          fields: { title: field.text({ required: true, unique: true }) },
        }).indexes,
      ).toEqual([
        { name: "test_widgets_title_key", on: ["title"], unique: true },
        {
          name: "test_widgets_created_at_idx",
          on: ["createdAt"],
          unique: false,
        },
        {
          name: "test_widgets_updated_at_idx",
          on: ["updatedAt"],
          unique: false,
        },
      ]);
    });

    it("rejects an index on an unknown column", () => {
      expect(() => define({ indexes: [{ on: ["nope"] }] })).toThrow(
        /unknown field "nope"/,
      );
    });
  });

  describe("admin defaults", () => {
    const definition = define({
      fields: {
        title: field.text({ required: true }),
        body: field.textarea({ nullable: true }),
        views: field.number({ integer: true, defaultValue: 0 }),
      },
    });

    it("defaults navigation to enabled", () => {
      expect(definition.admin.navigation.enabled).toBe(true);
    });

    it("defaults ordering to updatedAt desc", () => {
      expect(definition.admin.list.defaultOrderBy).toBe("updatedAt");
      expect(definition.admin.list.defaultOrder).toBe("desc");
    });

    it("defaults searchable fields to every text and textarea field", () => {
      expect(definition.admin.list.searchableFields).toEqual(["title", "body"]);
    });

    it("defaults the title field to the first text field", () => {
      expect(definition.admin.titleField).toBe("title");
    });

    it("defaults the form to every field in declaration order", () => {
      expect(definition.admin.form.fields).toEqual(["title", "body", "views"]);
    });

    it("derives the permission module from the id", () => {
      // The id, because a permission module is written into every role that
      // grants it - a display name would move those grants when somebody
      // reworded a heading, and a display name is a translation now anyway.
      expect(define().permissionModule).toBe("widget");
      expect(define({ id: "example.kb.article" }).permissionModule).toBe(
        "kb_article",
      );
    });

    it("prefers an explicit permission module", () => {
      expect(
        define({ admin: { permissionModule: "kb_articles" } }).permissionModule,
      ).toBe("kb_articles");
    });

    it("derives the admin path from the id", () => {
      expect(define().admin.path).toBe("test/widget");
      expect(define({ id: "example.kb.article" }).admin.path).toBe(
        "example/kb/article",
      );
    });

    it("prefers an explicit admin path", () => {
      expect(define({ admin: { path: "blog/articles" } }).admin.path).toBe(
        "blog/articles",
      );
    });

    it.each([
      ["a leading slash", "/blog/articles"],
      ["a trailing slash", "blog/articles/"],
      ["an empty segment", "blog//articles"],
      ["an uppercase segment", "blog/Articles"],
      ["an underscore", "blog/blog_articles"],
      ["a dotted segment", "blog.articles"],
      ["a segment opening with a digit", "blog/2articles"],
    ])("rejects an admin path with %s", (_name, path) => {
      expect(() => define({ admin: { path } })).toThrow(/admin\.path/);
    });

    it.each(["blog/create", "blog/edit"])(
      "rejects the admin path %s, which a form page already answers to",
      path => {
        expect(() => define({ admin: { path } })).toThrow(/admin\.path/);
      },
    );

    it("still allows an id whose derived path ends in a form segment", () => {
      expect(define({ id: "blog.post.create" }).admin.path).toBe(
        "blog/post/create",
      );
    });
  });

  describe("admin form presentation", () => {
    it("defaults create and edit to the dialog", () => {
      const dialog = define();

      expect(dialog.admin.create.mode).toBe("dialog");
      expect(dialog.admin.edit.mode).toBe("dialog");
    });

    it("takes page mode for create and edit independently", () => {
      const pageCreate = define({ admin: { create: { mode: "page" } } });
      const pageEdit = define({ admin: { edit: { mode: "page" } } });

      expect(pageCreate.admin.create.mode).toBe("page");
      expect(pageCreate.admin.edit.mode).toBe("dialog");
      expect(pageEdit.admin.create.mode).toBe("dialog");
      expect(pageEdit.admin.edit.mode).toBe("page");
    });

    it.each(["create", "edit"] as const)("rejects an unknown %s mode", key => {
      expect(() =>
        define({
          admin: {
            // Only reachable from JavaScript, or from a value that widened
            // upstream - the type refuses it outright.
            [key]: { mode: "drawer" as unknown as "dialog" },
          },
        }),
      ).toThrow(ContentEngineError);
    });
  });

  describe("admin form sections", () => {
    const sectioned = (
      sections: { fields: string[]; name: string }[],
      fields?: string[],
    ) =>
      define({
        fields: {
          title: field.text({ required: true }),
          body: field.textarea({ nullable: true }),
          views: field.number({ integer: true, defaultValue: 0 }),
        },
        admin: {
          form: { sections, ...(fields ? { fields } : {}) },
        },
      });

    it("defaults to no sections, which is one flat form", () => {
      expect(define().admin.form.sections).toEqual([]);
    });

    it("keeps the sections, in order, with their fields", () => {
      expect(
        sectioned([
          { fields: ["title"], name: "general" },
          { fields: ["body", "views"], name: "details" },
        ]).admin.form.sections,
      ).toEqual([
        { fields: ["title"], name: "general" },
        { fields: ["body", "views"], name: "details" },
      ]);
    });

    it("takes the field list from the sections, in their order", () => {
      // The sections *are* the form, so a field in no section is not on it -
      // and the order the sections give wins over the declaration order.
      expect(
        sectioned([
          { fields: ["views"], name: "stats" },
          { fields: ["title"], name: "general" },
        ]).admin.form.fields,
      ).toEqual(["views", "title"]);
    });

    it("rejects an unknown field", () => {
      expect(() => sectioned([{ fields: ["nope"], name: "general" }])).toThrow(
        /unknown field "nope"/,
      );
    });

    it("rejects declaring fields and sections together", () => {
      // Two answers to "which fields, in what order" that can disagree.
      expect(() =>
        sectioned([{ fields: ["title"], name: "general" }], ["body"]),
      ).toThrow(/both `fields` and `sections`/);
    });

    it("rejects one field in two sections", () => {
      // Rendered twice it would submit two values for one column.
      expect(() =>
        sectioned([
          { fields: ["title"], name: "general" },
          { fields: ["title"], name: "details" },
        ]),
      ).toThrow(/places "title" in both "general" and "details"/);
    });

    it("rejects two sections with one name", () => {
      expect(() =>
        sectioned([
          { fields: ["title"], name: "general" },
          { fields: ["body"], name: "general" },
        ]),
      ).toThrow(/declares "general" twice/);
    });

    it("rejects an empty section", () => {
      expect(() => sectioned([{ fields: [], name: "general" }])).toThrow(
        /lists no fields/,
      );
    });

    it.each(["General", "1st", "general-info", "general.info", ""])(
      "rejects the section name %s, which cannot be a message key",
      name => {
        expect(() => sectioned([{ fields: ["title"], name }])).toThrow(
          ContentEngineError,
        );
      },
    );
  });

  describe("admin validation", () => {
    it("rejects a searchable field that is not text-like", () => {
      expect(() =>
        define({
          fields: {
            title: field.text({ required: true }),
            views: field.number({ integer: true, defaultValue: 0 }),
          },
          admin: { list: { searchableFields: ["views"] } },
        }),
      ).toThrow(/not a text, textarea or slug field/);
    });

    it.each([
      ["list.columns", { list: { columns: ["nope"] } }],
      ["list.orderableFields", { list: { orderableFields: ["nope"] } }],
      ["form.fields", { form: { fields: ["nope"] } }],
      ["titleField", { titleField: "nope" }],
    ])("rejects an unknown field in admin.%s", (_name, adminOverrides) => {
      expect(() => define({ admin: { ...adminOverrides } })).toThrow(
        /unknown field "nope"/,
      );
    });

    it("rejects a defaultOrderBy that is not allowlisted", () => {
      expect(() =>
        define({
          fields: {
            title: field.text({ required: true }),
            views: field.number({ integer: true, defaultValue: 0 }),
          },
          admin: { list: { defaultOrderBy: "views" } },
        }),
      ).toThrow(/not in admin.list.orderableFields/);
    });

    it("allows a system column as defaultOrderBy without allowlisting it", () => {
      expect(() =>
        define({ admin: { list: { defaultOrderBy: "createdAt" } } }),
      ).not.toThrow();
    });

    it("rejects an index over an unknown column", () => {
      expect(() => define({ indexes: [{ on: ["nope"] }] })).toThrow(
        /indexes references unknown field "nope"/,
      );
    });

    it("allows an index over a system column", () => {
      expect(() =>
        define({ indexes: [{ on: ["title", "createdAt"] }] }),
      ).not.toThrow();
    });
  });

  describe("editorial", () => {
    type Overrides = NonNullable<Parameters<typeof define>[0]>;

    const editorialDefine = (
      editorial: Overrides["editorial"],
      overrides: Overrides = {},
    ) => define({ editorial, ...overrides });

    const publishable = {
      publication: { enabled: true } as const,
      publicApi: {
        enabled: true,
        path: "widgets",
        fields: ["title", "slug"],
      } as const,
      fields: {
        title: field.text({ required: true }),
        slug: field.slug({ source: "title" }),
      },
    };

    describe("defaults", () => {
      it("resolves to disabled when omitted", () => {
        expect(define().editorial).toEqual({
          enabled: false,
          preview: {
            enabled: false,
            expiresInMinutes: CONTENT_PREVIEW_DEFAULT_TTL_MINUTES,
            pathTemplate: null,
          },
          revisions: { retention: CONTENT_REVISION_DEFAULT_RETENTION },
          scheduling: { enabled: false },
        });
      });

      it("fills in the defaults when opted in with nothing else", () => {
        expect(editorialDefine({ enabled: true }).editorial).toEqual({
          enabled: true,
          preview: {
            enabled: false,
            expiresInMinutes: CONTENT_PREVIEW_DEFAULT_TTL_MINUTES,
            pathTemplate: null,
          },
          revisions: { retention: CONTENT_REVISION_DEFAULT_RETENTION },
          scheduling: { enabled: false },
        });
      });

      it("keeps a declared retention", () => {
        expect(
          editorialDefine({ enabled: true, revisions: { retention: 5 } })
            .editorial.revisions.retention,
        ).toBe(5);
      });
    });

    describe("retention validation", () => {
      it.each([0, -1, 501, 1.5])("rejects a retention of %s", retention => {
        expect(() =>
          editorialDefine({ enabled: true, revisions: { retention } }),
        ).toThrow(ContentEngineError);
      });

      it.each([CONTENT_REVISION_MIN_RETENTION, CONTENT_REVISION_MAX_RETENTION])(
        "accepts the boundary %s",
        retention => {
          expect(() =>
            editorialDefine({ enabled: true, revisions: { retention } }),
          ).not.toThrow();
        },
      );
    });

    describe("preview", () => {
      const withPreview = (preview: {
        enabled: true;
        expiresInMinutes?: number;
        pathTemplate?: string;
      }): ReturnType<typeof define> =>
        editorialDefine({ enabled: true, preview }, publishable);

      it("needs a public API", () => {
        expect(() =>
          editorialDefine(
            { enabled: true, preview: { enabled: true } },
            { publication: { enabled: true } },
          ),
        ).toThrow(/needs `publicApi/);
      });

      it("resolves its defaults", () => {
        expect(withPreview({ enabled: true }).editorial.preview).toEqual({
          enabled: true,
          expiresInMinutes: CONTENT_PREVIEW_DEFAULT_TTL_MINUTES,
          pathTemplate: null,
        });
      });

      it.each([0, 1441, 2.5])("rejects a TTL of %s minutes", value => {
        expect(() =>
          withPreview({ enabled: true, expiresInMinutes: value }),
        ).toThrow(ContentEngineError);
      });

      it.each([
        ["widgets/preview/{token}", "no leading slash"],
        ["/widgets/preview", "no placeholder"],
        ["/widgets/{token}/{token}", "two placeholders"],
        ["/widgets/{id}/{token}", "an unsupported placeholder"],
        ["/widgets//preview/{token}", "an empty segment"],
        ["/widgets/../{token}", "a traversal"],
        ["/widgets/pre view/{token}", "whitespace"],
      ])("rejects the pathTemplate %s (%s)", pathTemplate => {
        expect(() => withPreview({ enabled: true, pathTemplate })).toThrow(
          ContentEngineError,
        );
      });

      it("accepts a well-formed pathTemplate", () => {
        expect(
          withPreview({
            enabled: true,
            pathTemplate: "/widgets/preview/{token}",
          }).editorial.preview.pathTemplate,
        ).toBe("/widgets/preview/{token}");
      });
    });

    describe("scheduling", () => {
      it("needs publication", () => {
        expect(() =>
          editorialDefine({ enabled: true, scheduling: { enabled: true } }),
        ).toThrow(/needs `publication/);
      });

      it("is enabled alongside publication", () => {
        expect(
          editorialDefine(
            { enabled: true, scheduling: { enabled: true } },
            { publication: { enabled: true } },
          ).editorial.scheduling.enabled,
        ).toBe(true);
      });
    });

    describe("reserved field name", () => {
      const versionField = {
        title: field.text({ required: true }),
        version: field.number({ integer: true, defaultValue: 0 }),
      };

      it("rejects a field called `version` once enabled", () => {
        expect(() =>
          editorialDefine({ enabled: true }, { fields: versionField }),
        ).toThrow(/generated by `editorial`/);
      });

      it("allows it when editorial is omitted", () => {
        expect(() => define({ fields: versionField })).not.toThrow();
      });
    });

    it("rejects a content type id too long to store on a revision", () => {
      expect(() =>
        editorialDefine(
          { enabled: true },
          { id: `test.${"a".repeat(100)}`, tableName: "test_long_id" },
        ),
      ).toThrow(/limit for a revision/);
    });

    describe("addressable column", () => {
      it("accepts `version` in the admin list once enabled", () => {
        expect(
          editorialDefine(
            { enabled: true },
            { admin: { list: { columns: ["title", "version"] } } },
          ).admin.list.columns,
        ).toEqual(["title", "version"]);
      });

      it("rejects it when editorial is off", () => {
        expect(() =>
          define({ admin: { list: { columns: ["title", "version"] } } }),
        ).toThrow(/unknown field "version"/);
      });

      it("accepts an index over it once enabled", () => {
        expect(() =>
          editorialDefine(
            { enabled: true },
            { indexes: [{ on: ["version"] }] },
          ),
        ).not.toThrow();
      });
    });
  });

  describe("fixtures", () => {
    it("resolves the article fixture", () => {
      expect(testArticleContentType.permissionModule).toBe("article");
      expect(testArticleContentType.admin.list.searchableFields).toEqual([
        "title",
        "excerpt",
      ]);
      expect(testArticleContentType.admin.titleField).toBe("title");
    });

    it("resolves relation targets lazily", () => {
      const { category } = testArticleContentType.fields;
      expect(category.kind).toBe("relation");
      expect(category.target().id).toBe(testCategoryContentType.id);
    });
  });
});
