// @vitest-environment node
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { core_files } from "@/database/files";

import { buildContentFormSpec, buildFormSchemaFromSpec } from "./admin/spec";
import { defineContentType } from "./define";
import { field } from "./fields";
import { createContentTable } from "./server/table";

/**
 * A definition builder for the *rejection* cases only.
 *
 * The arguments are deliberately loose - every case below asserts on the error
 * `defineContentType` throws, so nothing reads the result and precise inference
 * would only be in the way. `articleType` is declared directly for that reason.
 */
const articleWith = (
  fields: Parameters<typeof defineContentType>[0]["fields"],
  extra: Partial<Parameters<typeof defineContentType>[0]> = {},
) =>
  defineContentType({
    id: "example.file-article",
    tableName: "example_file_articles",
    fields,
    ...extra,
  });

const coverImage = field.file({
  maxBytes: 5 * 1024 * 1024,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
});

const articleType = defineContentType({
  id: "example.file-article",
  tableName: "example_file_articles",
  fields: {
    title: field.text({ required: true }),
    coverImage,
  },
});

describe("the generated column", () => {
  const config = getTableConfig(createContentTable(articleType));

  it("is a nullable integer, not a URL or a key", () => {
    const column = config.columns.find(item => item.name === "coverImage");

    expect(column?.getSQLType()).toBe("integer");
    expect(column?.notNull).toBe(false);
    // Nothing about the file is copied onto the row.
    expect(config.columns.map(item => item.name)).not.toContain(
      "coverImageUrl",
    );
    expect(config.columns.map(item => item.name)).not.toContain(
      "coverImageKey",
    );
  });

  it("references core_files with ON DELETE RESTRICT", () => {
    const [foreignKey] = config.foreignKeys
      .map(fk => {
        const reference = fk.reference();

        return {
          columns: reference.columns.map(item => item.name),
          onDelete: fk.onDelete,
          onUpdate: fk.onUpdate,
          table: getTableName(reference.foreignTable),
          targets: reference.foreignColumns.map(item => item.name),
        };
      })
      .filter(fk => fk.columns.includes("coverImage"));

    expect(foreignKey).toEqual({
      columns: ["coverImage"],
      // The whole deletion-safety story: Postgres refuses, so
      // `StorageModel.deleteFile` can answer 409 instead of orphaning a record.
      onDelete: "restrict",
      onUpdate: "cascade",
      table: getTableName(core_files),
      targets: ["id"],
    });
  });

  it("is indexed, because RESTRICT scans the child side on every delete", () => {
    expect(config.indexes.map(item => item.config.name)).toContain(
      "example_file_articles_cover_image_idx",
    );
  });

  it("needs no `references` entry - the engine resolves core_files itself", () => {
    // A `relation` demands a thunk; a `file` has exactly one possible target.
    expect(() => createContentTable(articleType)).not.toThrow();
  });
});

describe("what a file field may not be", () => {
  it("rejects `localized: true`", () => {
    expect(() =>
      articleWith(
        {
          title: field.text({ localized: true, required: true }),
          cover: {
            ...coverImage,
            localized: true,
          } as unknown as typeof coverImage,
        },
        { localization: { enabled: true, defaultLocale: "en" } },
      ),
    ).toThrow(/`localized: true`, which is not supported/);
  });

  it("rejects it as an orderable column", () => {
    expect(() =>
      articleWith(
        { title: field.text({ required: true }), coverImage },
        { admin: { list: { orderableFields: ["coverImage"] } } },
      ),
    ).toThrow(/admin\.list\.orderableFields names the file field/);
  });

  it("rejects it as the default ordering", () => {
    expect(() =>
      articleWith(
        { title: field.text({ required: true }), coverImage },
        { admin: { list: { defaultOrderBy: "coverImage" } } },
      ),
    ).toThrow(/admin\.list\.defaultOrderBy names the file field/);
  });

  it("rejects it as the title or the colour", () => {
    expect(() =>
      articleWith(
        { title: field.text({ required: true }), coverImage },
        { admin: { titleField: "coverImage" } },
      ),
    ).toThrow(/admin\.titleField names the file field/);
    expect(() =>
      articleWith(
        { title: field.text({ required: true }), coverImage },
        { admin: { colorField: "coverImage" } },
      ),
    ).toThrow(/admin\.colorField names the file field/);
  });

  it("rejects it as a searchable column", () => {
    expect(() =>
      articleWith(
        { title: field.text({ required: true }), coverImage },
        { admin: { list: { searchableFields: ["coverImage"] } } },
      ),
    ).toThrow(/not a text, textarea or slug field/);
  });

  it("rejects it as a group or repeatable leaf", () => {
    expect(() =>
      articleWith({
        title: field.text({ required: true }),
        seo: field.group({
          fields: { cover: coverImage as never },
        }),
      }),
    ).toThrow(/file/);
  });

  it("rejects it as a public filter or sort", () => {
    const publicApi = {
      enabled: true as const,
      path: "articles",
      fields: ["slug", "coverImage", "publishedAt"] as never,
    };

    expect(() =>
      articleWith(
        {
          title: field.text({ required: true }),
          slug: field.slug({ source: "title" }),
          coverImage,
        },
        {
          publication: { enabled: true },
          publicApi: { ...publicApi, orderableFields: ["coverImage"] as never },
        },
      ),
    ).toThrow(/orderableFields includes the file field/);

    expect(() =>
      articleWith(
        {
          title: field.text({ required: true }),
          slug: field.slug({ source: "title" }),
          coverImage,
        },
        {
          publication: { enabled: true },
          publicApi: {
            ...publicApi,
            filterableFields: ["coverImage"] as never,
          },
        },
      ),
    ).toThrow(/not an equality-filterable field/);
  });
});

describe("the form spec", () => {
  const spec = buildContentFormSpec({
    definition: articleType,
    labelEnum: (name, value) => value,
    labelField: name => name,
    pluginId: "@vitnode/example",
  });
  const fileSpec = spec.fields.find(item => item.name === "coverImage");

  /**
   * The constraint line in the AdminCP, the `accept` attribute and the server's
   * own check all read these three values. They come off one descriptor, so
   * there is no second place for them to disagree.
   */
  it("carries the descriptor's own limits, normalised", () => {
    expect(fileSpec).toMatchObject({
      allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
      kind: "file",
      maxBytes: 5_242_880,
      nullable: true,
      required: false,
    });
  });

  it("carries the module the upload route lives under", () => {
    expect(spec.permissionModule).toBe(articleType.permissionModule);
  });

  it("never carries a default - a baked-in file id would be meaningless", () => {
    expect(fileSpec?.defaultValue).toBeUndefined();
  });

  it("holds the identifier, so nothing binary is in the form schema", () => {
    const schema = buildFormSchemaFromSpec(spec);

    expect(schema.safeParse({ title: "Hi", coverImage: 42 }).success).toBe(
      true,
    );
    expect(schema.safeParse({ title: "Hi", coverImage: null }).success).toBe(
      true,
    );
    // A form with no cover chosen is valid: the field is nullable.
    expect(schema.safeParse({ title: "Hi" }).success).toBe(true);
    expect(schema.safeParse({ title: "Hi", coverImage: 0 }).success).toBe(
      false,
    );
    expect(schema.safeParse({ title: "Hi", coverImage: -3 }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ title: "Hi", coverImage: "data:image/png;base64," })
        .success,
    ).toBe(false);
  });

  it("prefills the stored identifier when editing", () => {
    const schema = buildFormSchemaFromSpec(spec, {
      coverImage: 42,
      title: "Hi",
    });

    expect(schema.parse({ title: "Hi" })).toMatchObject({ coverImage: 42 });
  });
});

describe("the public projection", () => {
  const publicType = defineContentType({
    id: "example.public-file-article",
    tableName: "example_public_file_articles",
    fields: {
      title: field.text({ required: true }),
      slug: field.slug({ source: "title" }),
      coverImage,
    },
    publication: { enabled: true },
    publicApi: {
      enabled: true,
      path: "public-file-articles",
      fields: ["slug", "coverImage", "publishedAt"],
    },
  });

  it("exposes the normalised descriptor rather than the identifier", () => {
    const parsed = publicType.schemas.publicSelect.safeParse({
      coverImage: {
        height: 900,
        id: 42,
        mimeType: "image/webp",
        name: "cover.webp",
        size: 245123,
        url: "https://cdn.test/cover.webp",
        width: 1600,
      },
      publishedAt: new Date(0),
      slug: "hello",
    });

    expect(parsed.success).toBe(true);
  });

  it("refuses the identifier on its own", () => {
    expect(
      publicType.schemas.publicSelect.safeParse({
        coverImage: 42,
        publishedAt: new Date(0),
        slug: "hello",
      }).success,
    ).toBe(false);
  });

  it("refuses the storage key, the uploader and the metadata bag", () => {
    for (const leak of [
      { key: "month_8_2026/content/x.webp" },
      { userId: 7 },
      { pluginId: "@vitnode/blog" },
      { metadata: { dimensions: { height: 1, width: 1 } } },
      { folder: "content" },
    ]) {
      expect(
        publicType.schemas.publicSelect.safeParse({
          coverImage: {
            id: 42,
            mimeType: "image/webp",
            name: "cover.webp",
            size: 1,
            url: "https://cdn.test/cover.webp",
            ...leak,
          },
          publishedAt: new Date(0),
          slug: "hello",
        }).success,
      ).toBe(false);
    }
  });

  it("accepts null for a nullable file field", () => {
    expect(
      publicType.schemas.publicSelect.safeParse({
        coverImage: null,
        publishedAt: new Date(0),
        slug: "hello",
      }).success,
    ).toBe(true);
  });
});
