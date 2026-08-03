// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { ContentUserField } from "./types";

import { defineContentType } from "./define";
import { ContentEngineError } from "./errors";
import { field } from "./fields";

const label = { plural: "Widgets", singular: "Widget" };

const define = (
  overrides: Partial<Parameters<typeof defineContentType>[0]> = {},
) =>
  defineContentType({
    id: "test.widget",
    tableName: "test_widgets",
    fields: { title: field.text({ required: true }) },
    admin: { label },
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

    it("derives the permission module from the plural label", () => {
      expect(define({ admin: { label } }).permissionModule).toBe("widgets");
      expect(
        define({
          admin: { label: { plural: "Knowledge Articles", singular: "x" } },
        }).permissionModule,
      ).toBe("knowledge_articles");
    });

    it("prefers an explicit permission module", () => {
      expect(
        define({ admin: { label, permissionModule: "kb_articles" } })
          .permissionModule,
      ).toBe("kb_articles");
    });
  });

  describe("admin validation", () => {
    it("rejects a searchable field that is not text-like", () => {
      expect(() =>
        define({
          fields: {
            title: field.text({ required: true }),
            views: field.number({ integer: true, defaultValue: 0 }),
          },
          admin: { label, list: { searchableFields: ["views"] } },
        }),
      ).toThrow(/not a text or textarea field/);
    });

    it.each([
      ["list.columns", { list: { columns: ["nope"] } }],
      ["list.orderableFields", { list: { orderableFields: ["nope"] } }],
      ["form.fields", { form: { fields: ["nope"] } }],
      ["titleField", { titleField: "nope" }],
    ])("rejects an unknown field in admin.%s", (_name, adminOverrides) => {
      expect(() => define({ admin: { label, ...adminOverrides } })).toThrow(
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
          admin: { label, list: { defaultOrderBy: "views" } },
        }),
      ).toThrow(/not in admin.list.orderableFields/);
    });

    it("allows a system column as defaultOrderBy without allowlisting it", () => {
      expect(() =>
        define({ admin: { label, list: { defaultOrderBy: "createdAt" } } }),
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

  describe("fixtures", () => {
    it("resolves the article fixture", () => {
      expect(testArticleContentType.permissionModule).toBe("test_articles");
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
