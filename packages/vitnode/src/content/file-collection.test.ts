// @vitest-environment node
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { core_files } from "@/database/files";
import { testFileGalleryContentType } from "@/tests/content-fixtures";

import { buildContentFormSpec, buildFormSchemaFromSpec } from "./admin/spec";
import { findContentJunction } from "./advanced";
import { defineContentType } from "./define";
import { field } from "./fields";
import { createContentAdvancedTables } from "./server/advanced-tables";
import { createContentTable } from "./server/table";

/**
 * `field.file({ multiple: true })`, from the definition down to the migration.
 *
 * The single-file rules already have their own suite; this one is about the
 * *arity*, and every case here is a question whose answer differs from the
 * single-file one: where the value is stored, what the schemas take, what the
 * form spec says, and what the engine refuses.
 */

const gallery = field.file({
  multiple: true,
  max: 4,
  maxBytes: 5 * 1024 * 1024,
  allowedExtensions: [".jpg", ".png", ".webp"],
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
});

const galleryWith = (
  fields: Parameters<typeof defineContentType>[0]["fields"],
  extra: Partial<Parameters<typeof defineContentType>[0]> = {},
) =>
  defineContentType({
    id: "example.gallery-article",
    tableName: "example_gallery_articles",
    fields,
    ...extra,
  });

const galleryType = defineContentType({
  id: "example.gallery-article",
  tableName: "example_gallery_articles",
  fields: {
    title: field.text({ required: true }),
    gallery,
  },
});

describe("the descriptor", () => {
  it("defaults ordered to true, because a gallery's order is the point", () => {
    expect(gallery.ordered).toBe(true);
    expect(field.file({ maxBytes: 1, multiple: true }).ordered).toBe(true);
    expect(
      field.file({ maxBytes: 1, multiple: true, ordered: false }).ordered,
    ).toBe(false);
  });

  it("defaults nullable to false, unlike a single file", () => {
    // A single file is nullable by default - a record may not have a cover yet.
    // A collection has no column to be null, so the empty set stands in.
    expect(field.file({ maxBytes: 1 }).nullable).toBe(true);
    expect(field.file({ maxBytes: 1, multiple: true }).nullable).toBe(false);
  });

  it("normalises the per-file allowlists exactly as a single file does", () => {
    const strict = field.file({
      multiple: true,
      maxBytes: 1,
      allowedExtensions: ["GIF", ".Gif"],
      allowedMimeTypes: ["IMAGE/GIF"],
    });

    expect(strict.allowedExtensions).toEqual([".gif"]);
    expect(strict.allowedMimeTypes).toEqual(["image/gif"]);
  });
});

describe("the generated storage", () => {
  it("puts no column on the base table", () => {
    const config = getTableConfig(createContentTable(galleryType));

    expect(config.columns.map(item => item.name)).toEqual([
      "id",
      "createdAt",
      "updatedAt",
      "title",
    ]);
  });

  it("names a junction table after the table and the field", () => {
    expect(findContentJunction(galleryType.advanced, "gallery")).toMatchObject({
      field: "gallery",
      tableName: "example_gallery_articles_gallery",
    });
  });

  it("declares no index on a column that does not exist", () => {
    // A single file field gets one - Postgres does not index the child side of a
    // foreign key by itself. A collection's foreign keys are on the junction,
    // which brings its own primary key and reverse index.
    expect(
      galleryType.indexes.some(entry => entry.on.includes("gallery")),
    ).toBe(false);
  });

  it("points the far side at core_files with ON DELETE RESTRICT", () => {
    const table = createContentTable(galleryType);
    const tables = createContentAdvancedTables(galleryType, { table });
    const config = getTableConfig(tables.junctions.gallery);

    const keys = config.foreignKeys.map(foreignKey => {
      const reference = foreignKey.reference();

      return {
        columns: reference.columns.map(item => item.name),
        onDelete: foreignKey.onDelete,
        table: getTableName(reference.foreignTable),
      };
    });

    expect(keys).toEqual(
      expect.arrayContaining([
        // The record owns its references, so deleting it takes them.
        {
          columns: ["itemId"],
          onDelete: "cascade",
          table: "example_gallery_articles",
        },
        // And Postgres - not service code - is what refuses to delete a file the
        // gallery still shows.
        {
          columns: ["relatedItemId"],
          onDelete: "restrict",
          table: getTableName(core_files),
        },
      ]),
    );
  });

  it("carries a position, so the editor's order is storable", () => {
    const table = createContentTable(galleryType);
    const tables = createContentAdvancedTables(galleryType, { table });
    const config = getTableConfig(tables.junctions.gallery);

    expect(config.columns.map(item => item.name)).toEqual([
      "itemId",
      "relatedItemId",
      "position",
      "createdAt",
    ]);
  });
});

describe("the generated schemas", () => {
  const { create, publicSelectObject, selectObject, update } =
    testFileGalleryContentType.schemas;

  it("takes a list of identifiers, and defaults to the empty one on create", () => {
    const parsed = create.parse({ title: "Trip" }) as Record<string, unknown>;

    expect(parsed.gallery).toEqual([]);
    // A single file field has no default and is simply absent.
    expect(parsed.cover).toBeUndefined();
  });

  it("keeps the order it was sent, so `ordered: true` means something", () => {
    const parsed = update.parse({ gallery: [9, 2, 5] }) as Record<
      string,
      unknown
    >;

    expect(parsed.gallery).toEqual([9, 2, 5]);
  });

  it("refuses a repeated identifier rather than deduplicating it", () => {
    // Silently storing two where three were sent would hide a bug in the
    // caller's own list handling.
    expect(() => update.parse({ gallery: [4, 4] })).toThrow();
  });

  it("enforces the field's own min and max", () => {
    expect(() => update.parse({ gallery: [] })).toThrow();
    expect(() => update.parse({ gallery: [1, 2, 3, 4, 5] })).toThrow();
    expect(
      (update.parse({ gallery: [1, 2, 3, 4] }) as Record<string, unknown>)
        .gallery,
    ).toEqual([1, 2, 3, 4]);
  });

  it("selects the identifiers, and never a nullable list", () => {
    expect(() => selectObject.parse({ gallery: null })).toThrow();
  });

  it("crosses the public boundary as descriptors, once per entry", () => {
    const descriptor = {
      id: 3,
      mimeType: "image/webp",
      name: "photo.webp",
      size: 2048,
      url: "https://cdn.example/photo.webp",
    };

    const parsed = publicSelectObject.parse({
      cover: descriptor,
      gallery: [descriptor, { ...descriptor, id: 4 }],
      publishedAt: new Date(),
      slug: "trip",
      title: "Trip",
    });

    expect(parsed.gallery).toEqual([descriptor, { ...descriptor, id: 4 }]);
    // Never the identifiers, and never a bag with the storage key in it.
    expect(() => publicSelectObject.parse({ gallery: [3, 4] })).toThrow();
  });
});

describe("the AdminCP form spec", () => {
  const spec = buildContentFormSpec({
    definition: testFileGalleryContentType,
    labelEnum: (_name, value) => value,
    labelField: name => name,
    labelSection: name => ({ title: name }),
    pluginId: "test",
  });
  const galleryField = spec.fields.find(item => item.name === "gallery");
  const coverField = spec.fields.find(item => item.name === "cover");

  it("carries the arity, the order flag and the bounds", () => {
    expect(galleryField).toMatchObject({
      kind: "file",
      maxBytes: 5 * 1024 * 1024,
      maxItems: 4,
      minItems: 1,
      multiple: true,
      ordered: true,
    });
  });

  it("says nothing about count for a single file", () => {
    expect(coverField?.multiple).toBe(false);
    expect(coverField?.maxItems).toBeUndefined();
    expect(coverField?.minItems).toBeUndefined();
  });

  it("opens a create form on the empty list, so `min` is enforced there", () => {
    const json = z.toJSONSchema(buildFormSchemaFromSpec(spec)) as {
      properties: Record<string, { default?: unknown }>;
    };

    // `AutoForm` reads its `defaultValues` off the JSON Schema's `default`, and
    // this is what makes the empty list the form's starting value rather than
    // `undefined`. It matters twice: the control renders a list either way, and
    // `min: 1` is then checked against `[]` on submit - where `undefined` would
    // have satisfied `.optional()` and let a save through that the API refuses.
    expect(json.properties.gallery.default).toEqual([]);
    expect(json.properties.attachments.default).toEqual([]);
    // A single file has no list to open on, and no default it could have.
    expect(json.properties.cover.default).toBeUndefined();
  });

  it("holds identifiers rather than anything binary", () => {
    const schema = buildFormSchemaFromSpec(spec);
    const parsed = schema.parse({
      attachments: [],
      cover: 1,
      gallery: [7, 8],
      slug: "trip",
      title: "Trip",
    });

    expect(parsed.gallery).toEqual([7, 8]);
    // `min: 1` and `max: 4` reach the form too, so the submit button is disabled
    // rather than the save being refused after the uploads are already spent.
    expect(() =>
      schema.parse({
        attachments: [],
        cover: 1,
        gallery: [],
        slug: "trip",
        title: "Trip",
      }),
    ).toThrow();
    expect(() =>
      schema.parse({
        attachments: [],
        cover: 1,
        gallery: [1, 2, 3, 4, 5],
        slug: "trip",
        title: "Trip",
      }),
    ).toThrow();
  });
});

describe("what a file collection may not be", () => {
  it("refuses required and nullable, because the empty set is the empty state", () => {
    expect(() =>
      galleryWith({
        gallery: field.file({ maxBytes: 1, multiple: true, required: true }),
      }),
    ).toThrow(/neither required nor nullable/);

    expect(() =>
      galleryWith({
        gallery: field.file({ maxBytes: 1, multiple: true, nullable: true }),
      }),
    ).toThrow(/neither required nor nullable/);
  });

  it("refuses a max outside the absolute ceiling", () => {
    expect(() =>
      galleryWith({
        gallery: field.file({ maxBytes: 1, max: 0, multiple: true }),
      }),
    ).toThrow(/between 1 and 200/);

    expect(() =>
      galleryWith({
        gallery: field.file({ maxBytes: 1, max: 201, multiple: true }),
      }),
    ).toThrow(/between 1 and 200/);
  });

  it("refuses a min of zero, which is what leaving it out means", () => {
    expect(() =>
      galleryWith({
        gallery: field.file({ maxBytes: 1, min: 0, multiple: true }),
      }),
    ).toThrow(/between 1 and its max/);
  });

  it("refuses a min above its own max", () => {
    expect(() =>
      galleryWith({
        gallery: field.file({ maxBytes: 1, max: 2, min: 3, multiple: true }),
      }),
    ).toThrow(/between 1 and its max of 2/);
  });

  it("refuses min, max and ordered on a single file", () => {
    for (const extra of [{ min: 1 }, { max: 2 }, { ordered: true }] as const) {
      expect(() =>
        galleryWith({ cover: field.file({ maxBytes: 1, ...extra }) }),
      ).toThrow(/is not `multiple: true`/);
    }
  });

  it("refuses localized, exactly as a single file does", () => {
    expect(() =>
      galleryWith(
        {
          gallery: {
            ...field.file({ maxBytes: 1, multiple: true }),
            localized: true,
          } as unknown as typeof gallery,
        },
        { localization: { enabled: true, defaultLocale: "en" } },
      ),
    ).toThrow(/localized: true/);
  });

  it("is not a list column, an orderBy, a title or a colour", () => {
    expect(() =>
      galleryWith(
        { gallery, title: field.text({ required: true }) },
        { admin: { list: { columns: ["gallery"] } } },
      ),
    ).toThrow(/not one column on the base table/);

    expect(() =>
      galleryWith(
        { gallery, title: field.text({ required: true }) },
        { admin: { titleField: "gallery" } },
      ),
    ).toThrow(/not one column on the base table/);
  });

  it("is not something a public list can be ordered by", () => {
    expect(() =>
      galleryWith(
        { gallery, title: field.text({ required: true }) },
        {
          publication: { enabled: true },
          publicApi: {
            enabled: true,
            path: "gallery-articles",
            fields: ["title", "gallery"],
            orderableFields: ["gallery"],
          },
        },
      ),
    ).toThrow(/file field "gallery"/);
  });

  it("is not something an index can cover", () => {
    expect(() =>
      galleryWith(
        { gallery, title: field.text({ required: true }) },
        { indexes: [{ on: ["gallery"] }] },
      ),
    ).toThrow(/to-many file field "gallery"/);
  });
});
