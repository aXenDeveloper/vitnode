// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { testArticleContentType } from "@/tests/content-fixtures";

import { defineContentType } from "./define";
import { field } from "./fields";

const { schemas } = testArticleContentType;

const valid = { category: 1, title: "Hello world" };

describe("generated schemas", () => {
  describe("create", () => {
    it("accepts the required fields alone", () => {
      expect(schemas.create.safeParse(valid).success).toBe(true);
    });

    it("applies declared defaults, matching the column defaults", () => {
      expect(schemas.create.parse(valid)).toMatchObject({
        featured: false,
        status: "draft",
        views: 0,
      });
    });

    it("rejects a missing required field", () => {
      expect(schemas.create.safeParse({ title: "Hello world" }).success).toBe(
        false,
      );
    });

    it("rejects unknown keys instead of stripping them", () => {
      const result = schemas.create.safeParse({ ...valid, slug: "nope" });

      expect(result.success).toBe(false);
    });

    it("rejects the generated system columns", () => {
      for (const key of ["id", "createdAt", "updatedAt"]) {
        expect(schemas.create.safeParse({ ...valid, [key]: 1 }).success).toBe(
          false,
        );
      }
    });

    it("enforces the declared string bounds", () => {
      expect(schemas.create.safeParse({ ...valid, title: "ab" }).success).toBe(
        false,
      );
      expect(
        schemas.create.safeParse({ ...valid, title: "a".repeat(201) }).success,
      ).toBe(false);
    });

    it("enforces the declared number bounds", () => {
      expect(schemas.create.safeParse({ ...valid, views: -1 }).success).toBe(
        false,
      );
      expect(schemas.create.safeParse({ ...valid, views: 1.5 }).success).toBe(
        false,
      );
    });

    it("keeps nullable and optional distinct", () => {
      // `excerpt` is nullable, so `null` is a value...
      expect(
        schemas.create.safeParse({ ...valid, excerpt: null }).success,
      ).toBe(true);
      // ...but `title` is not.
      expect(schemas.create.safeParse({ ...valid, title: null }).success).toBe(
        false,
      );
    });

    it("takes dateTime as an ISO 8601 string", () => {
      expect(
        schemas.create.safeParse({
          ...valid,
          publishedAt: "2026-08-02T10:00:00.000Z",
        }).success,
      ).toBe(true);
      expect(
        schemas.create.safeParse({ ...valid, publishedAt: "2026-08-02" })
          .success,
      ).toBe(false);
    });

    it("rejects a value outside the enum", () => {
      expect(
        schemas.create.safeParse({ ...valid, status: "nope" }).success,
      ).toBe(false);
    });

    it("rejects a non-positive relation identifier", () => {
      expect(schemas.create.safeParse({ ...valid, category: 0 }).success).toBe(
        false,
      );
    });
  });

  describe("update", () => {
    it("accepts a single field", () => {
      expect(schemas.update.safeParse({ title: "Updated" }).success).toBe(true);
    });

    it("rejects an empty payload", () => {
      expect(schemas.update.safeParse({}).success).toBe(false);
    });

    it("still rejects unknown keys and bad values", () => {
      expect(schemas.update.safeParse({ slug: "nope" }).success).toBe(false);
      expect(schemas.update.safeParse({ views: -1 }).success).toBe(false);
    });

    it("never re-applies create defaults, so a partial update cannot reset a column", () => {
      expect(schemas.update.parse({ title: "Updated" })).toEqual({
        title: "Updated",
      });
    });
  });

  describe("select", () => {
    it("describes the API response, dates included", () => {
      const row = {
        author: null,
        category: 1,
        createdAt: new Date(),
        excerpt: null,
        featured: false,
        id: 1,
        publishedAt: null,
        status: "draft",
        title: "Hello world",
        updatedAt: new Date(),
        views: 0,
      };

      expect(schemas.select.safeParse(row).success).toBe(true);
    });
  });

  describe("editorial version", () => {
    const editorial = defineContentType({
      id: "test.schema-version",
      tableName: "test_schema_version",
      fields: { title: field.text({ required: true }) },
      editorial: { enabled: true },
      admin: { label: { plural: "Versions", singular: "Version" } },
    });

    const row = {
      createdAt: new Date(),
      id: 1,
      title: "Hello world",
      updatedAt: new Date(),
      version: 1,
    };

    it("is part of the response once editorial is enabled", () => {
      expect(editorial.schemas.select.safeParse(row).success).toBe(true);
      expect(editorial.schemas.selectObject.shape.version).toBeDefined();
    });

    it("is missing from the response without it", () => {
      expect(schemas.selectObject.shape.version).toBeUndefined();
    });

    it("is never writable", () => {
      // Both schemas are strict, so this is a rejection rather than a strip -
      // the version moves with the write, never in it.
      expect(
        editorial.schemas.create.safeParse({ title: "Hello", version: 2 })
          .success,
      ).toBe(false);
      expect(
        editorial.schemas.update.safeParse({ title: "Hello", version: 2 })
          .success,
      ).toBe(false);
    });

    it("is orderable once editorial is enabled", () => {
      expect(
        editorial.schemas.order.safeParse({ orderBy: "version" }).success,
      ).toBe(true);
      expect(schemas.order.safeParse({ orderBy: "version" }).success).toBe(
        false,
      );
    });
  });

  describe("order", () => {
    it("allows the declared orderable fields and the system columns", () => {
      for (const orderBy of [
        "title",
        "status",
        "createdAt",
        "updatedAt",
        "id",
      ]) {
        expect(schemas.order.safeParse({ orderBy }).success).toBe(true);
      }
    });

    it("rejects a column that is not allowlisted", () => {
      expect(schemas.order.safeParse({ orderBy: "views" }).success).toBe(false);
      expect(
        schemas.order.safeParse({ orderBy: "id; drop table" }).success,
      ).toBe(false);
    });

    it("only allows asc and desc", () => {
      expect(schemas.order.safeParse({ order: "sideways" }).success).toBe(
        false,
      );
    });
  });

  describe("filters", () => {
    it("exposes only filterable fields", () => {
      // `excerpt` is a textarea: it is searchable, not equality-filterable.
      expect(Object.keys(schemas.filters.shape).sort()).toEqual([
        "author",
        "category",
        "featured",
        "status",
        "title",
        "views",
      ]);
    });

    it("parses query-string values", () => {
      expect(
        schemas.filters.parse({ category: "3", featured: "true" }),
      ).toMatchObject({ category: 3, featured: "true" });
    });

    it("rejects an enum filter outside the declared values", () => {
      expect(schemas.filters.safeParse({ status: "nope" }).success).toBe(false);
    });
  });

  describe("params", () => {
    it("coerces the identifier from the path", () => {
      expect(schemas.params.parse({ id: "42" })).toEqual({ id: 42 });
    });
  });

  describe("form", () => {
    it("survives z.toJSONSchema, which AutoForm runs on every schema", () => {
      // `z.date()` throws here, which is why the form variant exists at all.
      expect(() => z.toJSONSchema(schemas.form)).not.toThrow();
    });

    it("exposes the declared form fields with their defaults", () => {
      const json = z.toJSONSchema(schemas.form);

      expect(Object.keys(json.properties ?? {})).toEqual(
        testArticleContentType.admin.form.fields,
      );
      expect(json.properties?.status).toMatchObject({ default: "draft" });
    });

    it("honours an explicit form field list", () => {
      const definition = defineContentType({
        id: "test.formsubset",
        tableName: "test_form_subsets",
        fields: {
          title: field.text({ required: true }),
          internalNote: field.textarea({ nullable: true }),
        },
        admin: {
          label: { plural: "Subsets", singular: "Subset" },
          form: { fields: ["title"] },
        },
      });

      expect(Object.keys(definition.schemas.form.shape)).toEqual(["title"]);
    });
  });

  describe("slug", () => {
    const withSource = defineContentType({
      id: "test.slugged",
      tableName: "test_slugged",
      fields: {
        title: field.text({ required: true }),
        slug: field.slug({ maxLength: 20, source: "title" }),
      },
      admin: { label: { plural: "Slugged", singular: "Slug" } },
    }).schemas;

    const withoutSource = defineContentType({
      id: "test.manual-slug",
      tableName: "test_manual_slugs",
      fields: {
        title: field.text({ required: true }),
        slug: field.slug(),
      },
      admin: { label: { plural: "Manuals", singular: "Manual" } },
    }).schemas;

    it("may be omitted from create when it has a source", () => {
      expect(withSource.create.safeParse({ title: "Hello" }).success).toBe(
        true,
      );
    });

    it("must be present in create when it has no source", () => {
      expect(withoutSource.create.safeParse({ title: "Hello" }).success).toBe(
        false,
      );
    });

    it("accepts a supplied value that the service will normalise", () => {
      expect(
        withSource.create.safeParse({ slug: "Hello World", title: "Hello" })
          .success,
      ).toBe(true);
    });

    it("rejects an empty string", () => {
      expect(
        withSource.create.safeParse({ slug: "", title: "Hello" }).success,
      ).toBe(false);
    });

    it("rejects a value past the descriptor's maxLength", () => {
      expect(
        withSource.create.safeParse({ slug: "a".repeat(21), title: "Hello" })
          .success,
      ).toBe(false);
    });

    it("is optional in update, like every other field", () => {
      expect(withoutSource.update.safeParse({ slug: "moved" }).success).toBe(
        true,
      );
    });

    it("appears in the response shape", () => {
      expect(Object.keys(withSource.selectObject.shape)).toContain("slug");
    });

    it("is equality-filterable", () => {
      expect(Object.keys(withSource.filters.shape)).toContain("slug");
      expect(withSource.filters.parse({ slug: "hello-world" })).toMatchObject({
        slug: "hello-world",
      });
    });

    it("survives z.toJSONSchema for AutoForm", () => {
      expect(() => z.toJSONSchema(withSource.form)).not.toThrow();
    });
  });
});
