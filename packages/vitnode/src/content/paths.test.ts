import { describe, expect, it } from "vitest";

import type { ContentFieldMap } from "./types";

import { field } from "./fields";
import {
  contentColumnsToValues,
  contentFieldPath,
  contentLeafColumnName,
  contentLeafColumns,
  contentStorageColumns,
  contentValuesToColumns,
  isContentCollectionField,
  partitionContentStorage,
  readContentPath,
  splitContentFieldPath,
} from "./paths";

/**
 * The one leaf-path <-> column mapping, tested on its own.
 *
 * Everything downstream - the table generator, the schemas, the services, the
 * revision snapshotter, the public projector, the search mapper and the AdminCP
 * - reads this module rather than re-deriving the rule, so a bug here would be
 * a bug in all of them at once.
 */

const target = { id: "test.target", tableName: "test_targets" };

const fields = {
  categories: field.relation({
    multiple: true,
    target: () => target as never,
  }),
  faq: field.repeatable({
    fields: { answer: field.textarea({ required: true }) },
  }),
  seo: field.group({
    fields: {
      description: field.textarea({ nullable: true }),
      title: field.text({ nullable: true }),
    },
    nullable: true,
  }),
  syndication: field.group({
    fields: { indexable: field.boolean({ defaultValue: true }) },
  }),
  title: field.text({ required: true }),
} as unknown as ContentFieldMap;

describe("paths", () => {
  it("builds and splits a canonical path", () => {
    expect(contentFieldPath("seo", "title")).toBe("seo.title");
    expect(splitContentFieldPath("seo.title")).toStrictEqual(["seo", "title"]);
  });

  it("is not a path when there is nothing on one side", () => {
    expect(splitContentFieldPath("title")).toBeNull();
    expect(splitContentFieldPath(".title")).toBeNull();
    expect(splitContentFieldPath("seo.")).toBeNull();
  });

  it("refuses a two-level path rather than reading it as one", () => {
    // `a.b.c` is not something this engine can mean anything by, and silently
    // reading it as `a` + `b.c` would generate a column nobody declared.
    expect(splitContentFieldPath("a.b.c")).toBeNull();
  });

  it("compiles a leaf to camelCase, like every other VitNode column", () => {
    expect(contentLeafColumnName("seo", "title")).toBe("seoTitle");
    expect(contentLeafColumnName("seo", "metaDescription")).toBe(
      "seoMetaDescription",
    );
  });
});

describe("contentLeafColumns", () => {
  it("emits every group leaf in declaration order", () => {
    expect(contentLeafColumns(fields).map(leaf => leaf.path)).toStrictEqual([
      "seo.description",
      "seo.title",
      "syndication.indexable",
    ]);
  });

  it("reads localization off the group rather than the leaf", () => {
    const localized = contentLeafColumns({
      seo: field.group({
        fields: { title: field.text({ nullable: true }) },
        localized: true,
      }),
    });

    expect(localized[0].localized).toBe(true);
  });
});

describe("contentStorageColumns", () => {
  it("flattens groups and drops collections", () => {
    expect(Object.keys(contentStorageColumns(fields))).toStrictEqual([
      "seoDescription",
      "seoTitle",
      "syndicationIndexable",
      "title",
    ]);
  });

  it("keeps a leaf's own nullability", () => {
    const columns = contentStorageColumns(fields);

    // The definition-time rules already prove both states are storable, so
    // nothing is relaxed here - `syndicationIndexable` stays NOT NULL DEFAULT.
    expect(columns.syndicationIndexable.nullable).toBe(false);
    expect(columns.seoTitle.nullable).toBe(true);
  });
});

describe("partitionContentStorage", () => {
  it("splits a field map by where each value is stored", () => {
    const partition = partitionContentStorage(fields);

    expect(Object.keys(partition.scalars)).toStrictEqual(["title"]);
    expect(Object.keys(partition.groups)).toStrictEqual(["seo", "syndication"]);
    expect(Object.keys(partition.relationCollections)).toStrictEqual([
      "categories",
    ]);
    expect(Object.keys(partition.repeatables)).toStrictEqual(["faq"]);
  });

  it("counts both collection kinds as not-a-column", () => {
    expect(isContentCollectionField(fields.categories)).toBe(true);
    expect(isContentCollectionField(fields.faq)).toBe(true);
    expect(isContentCollectionField(fields.seo)).toBe(false);
    expect(isContentCollectionField(fields.title)).toBe(false);
  });
});

describe("contentValuesToColumns", () => {
  it("emits only the leaves the caller supplied", () => {
    // The whole of what makes a partial group update partial: `seoTitle` is not
    // in the statement, so a concurrent edit of it is not overwritten.
    expect(
      contentValuesToColumns(fields, { seo: { description: "New" } }),
    ).toStrictEqual({ seoDescription: "New" });
  });

  it("expands null into every leaf", () => {
    expect(contentValuesToColumns(fields, { seo: null })).toStrictEqual({
      seoDescription: null,
      seoTitle: null,
    });
  });

  it("ignores a leaf the group does not declare", () => {
    expect(
      contentValuesToColumns(fields, { seo: { keywords: "no" } }),
    ).toStrictEqual({});
  });

  it("drops collections, which are written by the store instead", () => {
    expect(
      contentValuesToColumns(fields, { categories: [1], faq: [], title: "T" }),
    ).toStrictEqual({ title: "T" });
  });
});

describe("contentColumnsToValues", () => {
  it("folds leaf columns back into a nested object", () => {
    expect(
      contentColumnsToValues(fields, {
        seoDescription: "D",
        seoTitle: "T",
        syndicationIndexable: true,
        title: "Hello",
      }),
    ).toStrictEqual({
      seo: { description: "D", title: "T" },
      syndication: { indexable: true },
      title: "Hello",
    });
  });

  it("reads a nullable group back as null when every leaf is empty", () => {
    const values = contentColumnsToValues(fields, {
      seoDescription: null,
      seoTitle: null,
    });

    // The exact inverse of what writing `null` does - which is why a nullable
    // group requires nullable leaves.
    expect(values.seo).toBeNull();
  });

  it("keeps a partly-filled nullable group as an object", () => {
    const values = contentColumnsToValues(fields, {
      seoDescription: null,
      seoTitle: "T",
    });

    expect(values.seo).toStrictEqual({ description: null, title: "T" });
  });

  it("omits a group whose columns were not selected", () => {
    // A projection that left `seo` out must not make it look as if the record
    // has no SEO.
    expect(contentColumnsToValues(fields, { title: "Hello" })).toStrictEqual({
      title: "Hello",
    });
  });
});

describe("readContentPath", () => {
  const values = { seo: { title: "T" }, title: "Hello" };

  it("reads a top-level value and a leaf", () => {
    expect(readContentPath(values, "title")).toBe("Hello");
    expect(readContentPath(values, "seo.title")).toBe("T");
  });

  it("answers null through a group that is null", () => {
    expect(readContentPath({ seo: null }, "seo.title")).toBeNull();
  });

  it("answers null for a leaf that is not there", () => {
    expect(readContentPath(values, "seo.description")).toBeNull();
  });
});
