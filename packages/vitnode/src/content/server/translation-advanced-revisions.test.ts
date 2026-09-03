// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testAdvancedLocalizedContentType } from "@/tests/content-fixtures";

import type { ContentTranslationRevisionSnapshot } from "../revisions";
import type { ContentTranslationModel } from "./translation-model";

import { ContentRevisionNotRestorable } from "../errors";
import {
  contentTranslationRevisionSnapshot,
  projectTranslationRevisionSnapshot,
} from "./revision-snapshot";
import { createContentTranslationEditorialService } from "./translation-editorial-service";

const PLUGIN_ID = "@vitnode/example";
const ACTOR = { type: "staff" as const, userId: 1 };
const definition = testAdvancedLocalizedContentType;

const captured: {
  changedFields: readonly string[];
  operation: string;
  snapshot: ContentTranslationRevisionSnapshot;
  version: number;
}[] = [];

let storedRevision: ContentTranslationRevisionSnapshot | null = null;
let nextRevisionId = 100;

vi.mock("./revisions-model", () => ({
  CONTENT_REVISIONS_DEFAULT_PAGE_SIZE: 25,
  CONTENT_REVISIONS_MAX_PAGE_SIZE: 100,
  createContentRevisionsModel: ({
    languageId,
  }: {
    languageId?: null | number;
  }) => ({
    capture: (
      _tx: unknown,
      input: {
        changedFields: readonly string[];
        operation: string;
        snapshot: ContentTranslationRevisionSnapshot;
        version: number;
      },
    ) => {
      captured.push(input);
      nextRevisionId += 1;

      return nextRevisionId;
    },
    findById: (_itemId: number, revisionId: number) =>
      storedRevision !== null && languageId === 2
        ? {
            actorName: null,
            actorType: "staff" as const,
            actorUserId: 1,
            changedFields: [],
            createdAt: new Date(),
            id: revisionId,
            operation: "update" as const,
            restoredFromRevisionId: null,
            snapshot: storedRevision,
            version: 1,
          }
        : null,
    latest: () => null,
    list: () => ({
      edges: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    }),
  }),
}));

/** One translation row, in the **logical** shape the model returns. */
const row = (values: Record<string, unknown>, overrides = {}) =>
  ({
    createdAt: new Date("2026-01-01T00:00:00Z"),
    itemId: 7,
    languageId: 2,
    locale: "pl",
    publishedAt: null,
    status: "draft",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    values: { seo: null, slug: "witaj", title: "Witaj", ...values },
    version: 1,
    ...overrides,
  }) as never;

const translations = () => {
  const model = {
    create: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    // Stage 8 reads the base row's publication state to decide whether a
    // translation's address is publicly reachable. Resolved as "published" so
    // these suites keep exercising what they were written for.
    findBasePublication: vi
      .fn()
      .mockResolvedValue({ publishedAt: new Date(0), status: "published" }),
    findByLanguageId: vi.fn(),
    findByLocale: vi.fn(),
    findManyForItem: vi.fn(),
    findManyRowsForItem: vi.fn().mockResolvedValue([]),
    publish: vi.fn(),
    resolveDefaultLanguage: vi.fn(),
    resolveLanguage: vi.fn((locale: string) => ({
      id: locale === "en" ? 1 : 2,
      isDefault: locale === "en",
      isEnabled: true,
      locale,
    })),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  return model as unknown as ContentTranslationModel<typeof definition> &
    typeof model;
};

const service = (model: ReturnType<typeof translations>) => {
  const schemas = definition.schemas.translation;
  if (!schemas) throw new Error("fixture is not localized");

  return createContentTranslationEditorialService({
    c: {
      get: () => ({
        transaction: async <T>(body: (tx: unknown) => Promise<T>) =>
          await body({}),
      }),
    } as never,
    definition,
    pluginId: PLUGIN_ID,
    schemas,
    translations: model,
  });
};

beforeEach(() => {
  captured.length = 0;
  storedRevision = null;
  nextRevisionId = 100;
});

describe("snapshotting a localized group", () => {
  it("records the nested logical shape", () => {
    const snapshot = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        seo: { description: "SEO description", title: "SEO title" },
        slug: "article",
        title: "Article",
        updatedAt: new Date(),
        version: 1,
      },
      { languageId: 2, locale: "pl" },
    );

    expect(snapshot.fields).toStrictEqual({
      seo: { description: "SEO description", title: "SEO title" },
      slug: "article",
      title: "Article",
    });
  });

  it("records a nullable group that is empty as null", () => {
    const snapshot = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        seo: null,
        slug: "article",
        title: "Article",
        updatedAt: new Date(),
        version: 1,
      },
      { languageId: 2, locale: "pl" },
    );

    expect(snapshot.fields.seo).toBeNull();
  });

  it("never mentions a generated column name", () => {
    const snapshot = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        seo: { description: "D", title: "T" },
        slug: "article",
        title: "Article",
        updatedAt: new Date(),
        version: 1,
      },
      { languageId: 2, locale: "pl" },
    );

    // The flattened names are an internal mapping. A history that recorded one
    // would be invalidated by a rename that changed nothing anybody wrote.
    expect(Object.keys(snapshot.fields)).not.toContain("seoTitle");
    expect(Object.keys(snapshot.fields)).not.toContain("seoDescription");
    expect(JSON.stringify(snapshot)).not.toContain("seoTitle");
  });

  it("also reads a flattened database row", () => {
    // The base snapshotter is handed columns and the translation one is handed
    // logical values; both have to produce the same shape, or a revision written
    // by one path would restore differently from one written by the other.
    const snapshot = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        seoDescription: "D",
        seoTitle: "T",
        slug: "article",
        title: "Article",
        updatedAt: new Date(),
        version: 1,
      },
      { languageId: 2, locale: "pl" },
    );

    expect(snapshot.fields.seo).toStrictEqual({
      description: "D",
      title: "T",
    });
  });

  it("keeps publication state out of the restorable fields", () => {
    const snapshot = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        publishedAt: new Date("2026-02-01T00:00:00Z"),
        seo: { description: "D", title: "T" },
        slug: "article",
        status: "published",
        title: "Article",
        updatedAt: new Date(),
        version: 3,
      },
      { languageId: 2, locale: "pl" },
    );

    expect(snapshot.publication).toStrictEqual({
      publishedAt: "2026-02-01T00:00:00.000Z",
      status: "published",
    });
    expect(snapshot.fields).not.toHaveProperty("status");
    expect(
      projectTranslationRevisionSnapshot(definition, snapshot),
    ).not.toHaveProperty("status");
  });
});

describe("projecting a localized group for restore", () => {
  const snapshotOf = (
    fields: Record<string, unknown>,
  ): ContentTranslationRevisionSnapshot =>
    ({
      contentTypeId: definition.id,
      createdAt: "2026-01-01T00:00:00.000Z",
      fields,
      itemId: 7,
      languageId: 2,
      locale: "pl",
      schemaVersion: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    }) as ContentTranslationRevisionSnapshot;

  it("projects the whole nested group", () => {
    expect(
      projectTranslationRevisionSnapshot(
        definition,
        snapshotOf({
          seo: { description: "D", title: "T" },
          slug: "a",
          title: "A",
        }),
      ),
    ).toStrictEqual({
      seo: { description: "D", title: "T" },
      slug: "a",
      title: "A",
    });
  });

  it("ignores a leaf the group no longer declares", () => {
    // The past is allowed to mention things that no longer exist. Left in, the
    // strict object schema would turn every old revision into a permanent 422.
    expect(
      projectTranslationRevisionSnapshot(
        definition,
        snapshotOf({ seo: { gone: "x", title: "T" } }),
      ),
    ).toStrictEqual({ seo: { title: "T" } });
  });

  it("projects a null group as null rather than as an empty object", () => {
    expect(
      projectTranslationRevisionSnapshot(definition, snapshotOf({ seo: null })),
    ).toStrictEqual({ seo: null });
  });

  it("leaves a field added since the snapshot absent", () => {
    // Absent, not defaulted: the record keeps whatever it holds now.
    expect(
      projectTranslationRevisionSnapshot(
        definition,
        snapshotOf({ title: "A" }),
      ),
    ).toStrictEqual({ title: "A" });
  });
});

describe("restoring a localized group", () => {
  it("writes the whole group back through the model", async () => {
    const model = translations();
    storedRevision = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        seo: { description: "Historical description", title: "Historical" },
        slug: "witaj",
        title: "Witaj",
        updatedAt: new Date(),
        version: 1,
      },
      { languageId: 2, locale: "pl" },
    );

    model.findByLanguageId.mockResolvedValue(
      row({ seo: { description: "Current description", title: "Current" } }),
    );
    model.update.mockResolvedValue({
      changed: true,
      changedFields: ["seo.title", "seo.description"],
      row: row(
        {
          seo: { description: "Historical description", title: "Historical" },
        },
        { version: 2 },
      ),
      version: 2,
    });

    const outcome = await service(model).restore(7, "pl", 101, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    expect(outcome?.changed).toBe(true);
    // The group is written whole - the projected snapshot is its complete
    // historical value, and writing one leaf of it would restore half a state.
    expect(model.update.mock.calls[0][2]).toStrictEqual({
      seo: { description: "Historical description", title: "Historical" },
    });
    // One new immutable revision, stamped `restore`.
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("restore");
    expect(captured[0].snapshot.fields.seo).toStrictEqual({
      description: "Historical description",
      title: "Historical",
    });
  });

  it("restores one leaf and preserves its unchanged sibling", async () => {
    const model = translations();
    storedRevision = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        // Only the description differs from what is stored now.
        seo: { description: "Old description", title: "Same title" },
        slug: "witaj",
        title: "Witaj",
        updatedAt: new Date(),
        version: 1,
      },
      { languageId: 2, locale: "pl" },
    );

    model.findByLanguageId.mockResolvedValue(
      row({ seo: { description: "New description", title: "Same title" } }),
    );
    model.update.mockResolvedValue({
      changed: true,
      changedFields: ["seo.description"],
      row: row(
        { seo: { description: "Old description", title: "Same title" } },
        { version: 2 },
      ),
      version: 2,
    });

    const outcome = await service(model).restore(7, "pl", 101, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    // Canonical paths, and only the leaf that moved.
    expect(outcome?.changedFields).toStrictEqual(["seo.description"]);
    expect(model.update.mock.calls[0][2]).toStrictEqual({
      seo: { description: "Old description", title: "Same title" },
    });
  });

  it("is a no-op when the group already matches", async () => {
    const model = translations();
    const current = { seo: { description: "D", title: "T" } };
    storedRevision = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        slug: "witaj",
        title: "Witaj",
        updatedAt: new Date(),
        version: 1,
        ...current,
      },
      { languageId: 2, locale: "pl" },
    );
    model.findByLanguageId.mockResolvedValue(row(current));

    const outcome = await service(model).restore(7, "pl", 101, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    // A scalar diff would compare the two `seo` objects by identity and report a
    // change here, writing a revision that restored nothing.
    expect(outcome?.changed).toBe(false);
    expect(outcome?.changedFields).toStrictEqual([]);
    expect(model.update).not.toHaveBeenCalled();
    expect(captured).toHaveLength(0);
  });

  it("touches only this locale's localized values", async () => {
    const model = translations();
    storedRevision = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        seo: { description: "D", title: "T" },
        slug: "witaj",
        title: "Witaj",
        updatedAt: new Date(),
        version: 1,
      },
      { languageId: 2, locale: "pl" },
    );
    model.findByLanguageId.mockResolvedValue(row({ seo: null }));
    model.update.mockResolvedValue({
      changed: true,
      changedFields: ["seo.title", "seo.description"],
      row: row({ seo: { description: "D", title: "T" } }, { version: 2 }),
      version: 2,
    });

    await service(model).restore(7, "pl", 101, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    // One locale, by construction: the update is addressed to `"pl"` and the
    // payload carries localized fields only - never `featured`, never `faq`.
    expect(model.update.mock.calls[0][1]).toBe("pl");
    const payload = model.update.mock.calls[0][2] as Record<string, unknown>;
    expect(Object.keys(payload)).toStrictEqual(["seo"]);
    expect(payload).not.toHaveProperty("featured");
    expect(payload).not.toHaveProperty("faq");
    expect(payload).not.toHaveProperty("status");
  });

  it("keeps the translation's publication state", async () => {
    const model = translations();
    storedRevision = contentTranslationRevisionSnapshot(
      definition,
      {
        createdAt: new Date(),
        itemId: 7,
        // The snapshot was taken while the translation was a draft...
        publishedAt: null,
        seo: { description: "D", title: "T" },
        slug: "witaj",
        status: "draft",
        title: "Witaj",
        updatedAt: new Date(),
        version: 1,
      },
      { languageId: 2, locale: "pl" },
    );
    // ...and it is published now. A field restore must not take it down.
    model.findByLanguageId.mockResolvedValue(
      row({ seo: null }, { publishedAt: new Date(), status: "published" }),
    );
    model.update.mockResolvedValue({
      changed: true,
      changedFields: ["seo.title", "seo.description"],
      row: row(
        { seo: { description: "D", title: "T" } },
        { publishedAt: new Date(), status: "published", version: 2 },
      ),
      version: 2,
    });

    const outcome = await service(model).restore(7, "pl", 101, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    expect(model.update.mock.calls[0][2]).not.toHaveProperty("status");
    expect((outcome?.row as unknown as { status: string }).status).toBe(
      "published",
    );
    // The version still moves forward, and the new revision records the state.
    expect(outcome?.version).toBe(2);
    expect(captured[0].snapshot.publication?.status).toBe("published");
  });

  it("rejects a snapshot the current schema refuses", async () => {
    const model = translations();
    storedRevision = {
      contentTypeId: definition.id,
      createdAt: "2026-01-01T00:00:00.000Z",
      // `seo.title` is `maxLength: 200`. A snapshot taken before the limit was
      // tightened cannot be restored into today's schema.
      fields: { seo: { description: null, title: "x".repeat(201) } },
      itemId: 7,
      languageId: 2,
      locale: "pl",
      schemaVersion: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    };
    model.findByLanguageId.mockResolvedValue(row({}));

    await expect(
      service(model).restore(7, "pl", 101, {
        actor: ACTOR,
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ContentRevisionNotRestorable);

    // All or nothing: nothing was written and no revision claims otherwise.
    expect(model.update).not.toHaveBeenCalled();
    expect(captured).toHaveLength(0);
  });
});
