// @vitest-environment node
import { describe, expect, it } from "vitest";

import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";
import {
  contentPublicCollectionFields,
  contentPublicSelection,
  createContentPublicProjector,
} from "./public-service";

/**
 * What a public response is allowed to contain, stated as an exact set.
 *
 * Every other public test asserts that a particular field is present or a
 * particular one is absent. This one asserts the **whole** key set, which is the
 * only shape of assertion that catches a field nobody thought to check: a leaf
 * added to a group later, a system column that started being selected, an
 * internal storage name leaking through the flattening.
 *
 * The fixture is deliberately hostile - every kind has a public member and a
 * private sibling, so "the allowlist is a filter" has something to be wrong
 * about in each of them.
 */
const contentType = defineContentType({
  id: "test.privacy",
  tableName: "test_privacy",
  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
  editorial: { enabled: true },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    /** Localized and private: the leak a locale-aware read could produce. */
    internalNotes: field.textarea({ localized: true, nullable: true }),
    /** Shared and private. */
    revenue: field.number({ integer: true, defaultValue: 0 }),
    featured: field.boolean({ defaultValue: false }),
    /** A localized group with one public leaf and one private one. */
    seo: field.group({
      localized: true,
      nullable: true,
      fields: {
        title: field.text({ nullable: true, maxLength: 200 }),
        robots: field.text({ nullable: true, maxLength: 100 }),
      },
    }),
    /** A shared group, entirely private. */
    syndication: field.group({
      fields: {
        indexable: field.boolean({ defaultValue: true }),
        partnerKey: field.text({ nullable: true, maxLength: 100 }),
      },
    }),
    /** A repeatable with one public leaf and one private one. */
    faq: field.repeatable({
      fields: {
        question: field.text({ required: true, maxLength: 200 }),
        answer: field.textarea({ required: true }),
        moderatorNote: field.textarea({ nullable: true }),
      },
    }),
    /** A private to-many relation, and a public one. */
    tags: field.relation({ multiple: true, self: true }),
    hiddenLinks: field.relation({ multiple: true, self: true }),
  },
  publicApi: {
    enabled: true,
    path: "privacy",
    fields: [
      "title",
      "slug",
      "featured",
      "seo.title",
      "faq.question",
      "faq.answer",
      "tags",
      "publishedAt",
    ],
    orderableFields: ["publishedAt"],
  },
  admin: {
    list: { columns: ["featured", "status"] },
    form: { fields: ["faq", "tags", "hiddenLinks", "syndication"] },
  },
});

const model = createContentModel(contentType);
const project = createContentPublicProjector(contentType);

/**
 * A raw row carrying **everything** - including the values the projector must
 * drop and the flattened storage names it must never surface.
 *
 * Group leaves arrive already nested, which is what the read layer hands the
 * projector; the flat `seoRobots`-style columns are added alongside so a
 * projector that copied unknown keys through would be caught here rather than
 * in production.
 */
const rawRow = {
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  faq: [
    {
      answer: "Because.",
      id: 11,
      moderatorNote: "spam risk",
      question: "Why?",
    },
  ],
  featured: true,
  hiddenLinks: [99],
  id: 7,
  internalNotes: "Do not publish before Friday.",
  // The columns the translation and base tables really hold, flattened.
  internalNotesColumn: "leak",
  languageId: 3,
  publishedAt: new Date("2026-02-01T00:00:00.000Z"),
  revenue: 12_345,
  seo: { robots: "noindex", title: "Public SEO title" },
  seoRobots: "noindex",
  seoTitle: "Public SEO title",
  slug: "hello-world",
  status: "published",
  syndication: { indexable: false, partnerKey: "secret-key" },
  syndicationIndexable: false,
  syndicationPartnerKey: "secret-key",
  tags: [1, 2],
  title: "Hello world",
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  version: 9,
};

describe("the public projection is an allowlist, not a filter", () => {
  const projected = project(rawRow) as Record<string, unknown>;

  it("carries exactly the allowlisted keys", () => {
    // `id` is absent because the allowlist does not name it: the cursor needs
    // it from the database, and the projector drops it again.
    expect(Object.keys(projected).sort()).toEqual([
      "faq",
      "featured",
      "publishedAt",
      "seo",
      "slug",
      "tags",
      "title",
    ]);
  });

  it.each([
    ["a private localized scalar", "internalNotes"],
    ["a private shared scalar", "revenue"],
    ["a wholly private group", "syndication"],
    ["a private relation", "hiddenLinks"],
    ["the editorial version", "version"],
    ["the internal language id", "languageId"],
    ["a system timestamp", "createdAt"],
    ["a system timestamp", "updatedAt"],
    ["the publication state", "status"],
    ["the cursor identifier", "id"],
  ])("drops %s (%s)", (_why, key) => {
    expect(projected).not.toHaveProperty(key);
  });

  it("never surfaces a flattened storage column name", () => {
    // `seo.title` is stored as `seoTitle`. A response that carried the column
    // name would publish an internal detail *and* give a client two spellings
    // of one value.
    for (const key of Object.keys(projected)) {
      expect(key).not.toMatch(/^(seo|syndication|internalNotes)[A-Z]/);
    }
  });

  it("keeps a group to the leaves the allowlist named", () => {
    expect(projected.seo).toEqual({ title: "Public SEO title" });
  });

  it("keeps a repeatable child to its public leaves plus its identity", () => {
    // The identifier stays: it is what an editor's `set` matches on, and a
    // public consumer needs a stable key per row. The moderator note does not.
    expect(projected.faq).toEqual([
      { answer: "Because.", id: 11, question: "Why?" },
    ]);
  });

  it("exposes a relation as identifiers and nothing else", () => {
    expect(projected.tags).toEqual([1, 2]);
  });

  it("projects a missing collection as an empty list, not as undefined", () => {
    const empty = project({ ...rawRow, faq: undefined, tags: undefined }) as {
      faq: unknown;
      tags: unknown;
    };

    expect(empty.faq).toEqual([]);
    expect(empty.tags).toEqual([]);
  });
});

describe("the public read never fetches a private column", () => {
  const selection = contentPublicSelection(contentType, model.columns);

  it("selects the allowlist plus the cursor, and nothing else", () => {
    expect(Object.keys(selection).sort()).toEqual([
      "featured",
      "id",
      "publishedAt",
      "seo.title",
      "slug",
      "title",
    ]);
  });

  it("leaves every private column out of the SELECT entirely", () => {
    // Defence in depth that matters: a private column that is never fetched
    // cannot be leaked by a mistake in the projector further downstream.
    for (const name of [
      "internalNotes",
      "revenue",
      "seo.robots",
      "syndication.indexable",
      "syndication.partnerKey",
      "version",
      "status",
    ]) {
      expect(selection).not.toHaveProperty(name);
    }
  });

  it("loads only the collections the allowlist exposes", () => {
    // A public list must not join a junction table it will then discard, and
    // `hiddenLinks` is private - so it is not even a candidate.
    expect(contentPublicCollectionFields(contentType).sort()).toEqual([
      "faq",
      "tags",
    ]);
  });
});

describe("the generated public schema agrees with the projection", () => {
  it("describes the projected keys plus the one piece of generated metadata", () => {
    // The OpenAPI contract and the runtime projection are built from the same
    // allowlist, so the only difference between them is `locale` - which the
    // route adds because a localized response has to say which language it is,
    // and which `publicApi.fields` therefore reserves rather than accepts.
    const shape = model.schemas.publicSelectObject.shape;
    const projected = Object.keys(project(rawRow));

    expect(Object.keys(shape).sort()).toEqual([...projected, "locale"].sort());
  });

  it("parses a projected row once the route has stamped the locale on it", () => {
    expect(
      model.schemas.publicSelectObject.safeParse({
        ...(project(rawRow) as Record<string, unknown>),
        locale: "en",
      }).success,
    ).toBe(true);
  });
});
