import { describe, expect, it } from "vitest";

import type { ContentFieldMap } from "../types";

import { defineContentType } from "../define";
import { field } from "../fields";
import {
  contentPublicCollectionFields,
  createContentPublicProjector,
  nestContentPublicRow,
} from "./public-service";
import { changedPathsToColumns, diffChangedPaths } from "./query";
import {
  contentRevisionSnapshot,
  projectRevisionSnapshot,
} from "./revision-snapshot";
import { contentSearchDocument } from "./search-document";

/**
 * The pure projections Stage 6 adds, tested without a database.
 *
 * Each of these is a rule that is easy to state and easy to get subtly wrong:
 * which paths a patch changed, which columns that becomes, what a snapshot
 * records, what a search document is made of, and which keys a public response
 * carries. All of them are functions of their arguments, so all of them are
 * table tests rather than fixtures.
 */

const categoryContentType = defineContentType({
  fields: { name: field.text({ required: true }) },
  id: "test.proj-category",
  tableName: "test_proj_categories",
});

const articleContentType = defineContentType({
  admin: {
    list: { columns: ["title"] },
    titleField: "title",
  },
  editorial: { enabled: true },
  fields: {
    categories: field.relation({
      multiple: true,
      target: () => categoryContentType,
    }),
    faq: field.repeatable({
      fields: {
        answer: field.textarea({ required: true }),
        question: field.text({ required: true }),
      },
    }),
    related: field.relation({ multiple: true, ordered: true, self: true }),
    seo: field.group({
      fields: {
        description: field.textarea({ nullable: true }),
        title: field.text({ nullable: true }),
      },
      nullable: true,
    }),
    slug: field.slug({ source: "title" }),
    syndication: field.group({
      fields: { indexable: field.boolean({ defaultValue: true }) },
    }),
    title: field.text({ required: true }),
  },
  id: "test.proj-article",
  publicApi: {
    enabled: true,
    fields: [
      "title",
      "slug",
      "categories",
      "seo.title",
      "faq.question",
      "publishedAt",
    ],
    path: "proj-articles",
  },
  publication: { enabled: true },
  search: {
    contentFields: ["title", "seo.title", "faq.question"],
    enabled: true,
    pathTemplate: "/proj-articles/{slug}",
    titleField: "title",
  },
  tableName: "test_proj_articles",
});

const fields = articleContentType.fields as unknown as ContentFieldMap;

/** A row as it comes back from Postgres: flat columns, not nested values. */
const row = {
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  id: 7,
  publishedAt: new Date("2026-01-02T00:00:00.000Z"),
  seoDescription: "Old description",
  seoTitle: "Old SEO",
  slug: "hello",
  status: "published",
  syndicationIndexable: true,
  title: "Hello",
  updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  version: 3,
};

describe("diffChangedPaths", () => {
  it("names the leaves that moved, never the group", () => {
    expect(
      diffChangedPaths(fields, row, { seo: { description: "New" } }),
    ).toStrictEqual(["seo.description"]);
  });

  it("drops a leaf that is already what was sent", () => {
    expect(
      diffChangedPaths(fields, row, {
        seo: { description: "Old description", title: "New SEO" },
      }),
    ).toStrictEqual(["seo.title"]);
  });

  it("reports every non-empty leaf when a group is blanked", () => {
    expect(diffChangedPaths(fields, row, { seo: null })).toStrictEqual([
      "seo.description",
      "seo.title",
    ]);
  });

  it("reports nothing when a group was already blank", () => {
    expect(
      diffChangedPaths(
        fields,
        { seoDescription: null, seoTitle: null },
        {
          seo: null,
        },
      ),
    ).toStrictEqual([]);
  });

  it("still reports a plain scalar by its own name", () => {
    expect(diffChangedPaths(fields, row, { title: "Goodbye" })).toStrictEqual([
      "title",
    ]);
  });

  it("ignores collections, which the store diffs instead", () => {
    expect(diffChangedPaths(fields, row, { categories: [1] })).toStrictEqual(
      [],
    );
  });
});

describe("changedPathsToColumns", () => {
  it("writes only the leaves that moved", () => {
    expect(
      changedPathsToColumns(fields, { seo: { description: "New" } }, [
        "seo.description",
      ]),
    ).toStrictEqual({ seoDescription: "New" });
  });

  it("writes null into every leaf of a blanked group", () => {
    expect(
      changedPathsToColumns(fields, { seo: null }, [
        "seo.description",
        "seo.title",
      ]),
    ).toStrictEqual({ seoDescription: null, seoTitle: null });
  });
});

describe("contentRevisionSnapshot", () => {
  it("records groups nested and collections as identity", () => {
    const snapshot = contentRevisionSnapshot(articleContentType, {
      ...row,
      categories: [5, 2],
      faq: [{ answer: "A", id: 11, question: "Q" }],
      related: [9],
    });

    expect(snapshot.fields.seo).toStrictEqual({
      description: "Old description",
      title: "Old SEO",
    });
    expect(snapshot.fields.categories).toStrictEqual([5, 2]);
    expect(snapshot.fields.related).toStrictEqual([9]);
    expect(snapshot.fields.faq).toStrictEqual([
      { answer: "A", id: 11, question: "Q" },
    ]);
    // Never the flattened column names: those are an internal mapping, and a
    // history that recorded one would be invalidated by a rename.
    expect(snapshot.fields).not.toHaveProperty("seoTitle");
  });

  it("records an empty nullable group as null", () => {
    const snapshot = contentRevisionSnapshot(articleContentType, {
      ...row,
      seoDescription: null,
      seoTitle: null,
    });

    expect(snapshot.fields.seo).toBeNull();
  });

  it("records an absent collection as the empty set", () => {
    const snapshot = contentRevisionSnapshot(articleContentType, row);

    expect(snapshot.fields.categories).toStrictEqual([]);
    expect(snapshot.fields.faq).toStrictEqual([]);
  });
});

describe("projectRevisionSnapshot", () => {
  it("drops a leaf the group no longer declares", () => {
    const projected = projectRevisionSnapshot(articleContentType, {
      contentTypeId: articleContentType.id,
      createdAt: row.createdAt.toISOString(),
      fields: {
        seo: { keywords: "gone", title: "Kept" },
        title: "Hello",
      },
      id: 7,
      schemaVersion: 1,
      updatedAt: row.updatedAt.toISOString(),
      version: 1,
    });

    // The past is allowed to mention things that no longer exist; left in, it
    // would hit the strict object schema and make every old revision a 422.
    expect(projected.seo).toStrictEqual({ title: "Kept" });
  });

  it("keeps a child's id so a restore can match rather than recreate", () => {
    const projected = projectRevisionSnapshot(articleContentType, {
      contentTypeId: articleContentType.id,
      createdAt: row.createdAt.toISOString(),
      fields: { faq: [{ answer: "A", gone: "x", id: 11, question: "Q" }] },
      id: 7,
      schemaVersion: 1,
      updatedAt: row.updatedAt.toISOString(),
      version: 1,
    });

    expect(projected.faq).toStrictEqual([
      { answer: "A", id: 11, question: "Q" },
    ]);
  });
});

describe("contentSearchDocument", () => {
  const values = {
    ...row,
    faq: [
      { answer: "A1", id: 11, question: "First question" },
      { answer: "A2", id: 12, question: "Second question" },
    ],
    seo: { description: null, title: "SEO heading" },
  };

  it("reads a group leaf through its canonical path", () => {
    const document = contentSearchDocument(articleContentType, values);

    expect(document?.content).toContain("SEO heading");
  });

  it("joins a repeatable leaf in position order", () => {
    const document = contentSearchDocument(articleContentType, values);

    // Position order rather than insertion order: position is what the page
    // renders, and an index that disagreed would highlight the wrong entry.
    expect(document?.content).toContain("First question\nSecond question");
  });

  it("indexes nothing from a group that is null", () => {
    const document = contentSearchDocument(articleContentType, {
      ...values,
      seo: null,
    });

    expect(document?.content).not.toContain("SEO heading");
    expect(document?.content).toContain("Hello");
  });

  it("never indexes relation identifiers as text", () => {
    const document = contentSearchDocument(articleContentType, {
      ...values,
      categories: [42],
    });

    expect(document?.content).not.toContain("42");
  });
});

describe("public projection", () => {
  const project = createContentPublicProjector(articleContentType);

  it("nests the exposed leaves and drops the private ones", () => {
    const projected = project(
      nestContentPublicRow({
        categories: [2, 5],
        faq: [{ answer: "secret", id: 11, question: "Public?" }],
        id: 7,
        publishedAt: row.publishedAt,
        "seo.title": "SEO heading",
        slug: "hello",
        title: "Hello",
      }),
    );

    expect(projected).toStrictEqual({
      categories: [2, 5],
      faq: [{ id: 11, question: "Public?" }],
      publishedAt: row.publishedAt,
      seo: { title: "SEO heading" },
      slug: "hello",
      title: "Hello",
    });
  });

  it("omits a private collection and a private group entirely", () => {
    const projected = project(nestContentPublicRow({ id: 7, title: "Hello" }));

    expect(projected).not.toHaveProperty("related");
    expect(projected).not.toHaveProperty("syndication");
    // `id` is fetched for the cursor and dropped again unless it was exposed.
    expect(projected).not.toHaveProperty("id");
  });

  it("names only the collections the allowlist actually exposes", () => {
    // `related` is private, so a public list joins nothing for it.
    expect(contentPublicCollectionFields(articleContentType)).toStrictEqual([
      "categories",
      "faq",
    ]);
  });
});
