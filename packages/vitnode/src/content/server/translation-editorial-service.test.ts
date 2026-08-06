// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testLocalizedGuideContentType } from "@/tests/content-fixtures";

import type { ContentTranslationRevisionSnapshot } from "../revisions";
import type { ContentTranslationModel } from "./translation-model";

import { ContentRevisionNotRestorable } from "../errors";
import { createContentTranslationEditorialService } from "./translation-editorial-service";

const PLUGIN_ID = "@vitnode/example";
const ACTOR = { type: "staff" as const, userId: 1 };

/** Every revision written during one test, in order. */
const captured: {
  changedFields: readonly string[];
  itemId: number;
  languageId: null | number;
  operation: string;
  restoredFromRevisionId?: number;
  snapshot: ContentTranslationRevisionSnapshot;
  version: number;
}[] = [];

let nextRevisionId = 100;
let storedRevision: ContentTranslationRevisionSnapshot | null = null;
let revisionLanguageId = 1;

// The revisions model is a real, tested unit of its own; what matters here is
// *what this layer asks it to write* - which language, which operation, which
// snapshot - so it records instead of touching a database.
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
        itemId: number;
        operation: string;
        restoredFromRevisionId?: number;
        snapshot: ContentTranslationRevisionSnapshot;
        version: number;
      },
    ) => {
      captured.push({ ...input, languageId: languageId ?? null });
      nextRevisionId += 1;

      return nextRevisionId;
    },
    findById: (_itemId: number, revisionId: number) =>
      storedRevision !== null && languageId === revisionLanguageId
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

const language = (locale: string, id: number) => ({
  id,
  isDefault: locale === "en",
  isEnabled: true,
  locale,
});

const row = (overrides: Record<string, unknown> = {}) =>
  ({
    createdAt: new Date("2026-01-01T00:00:00Z"),
    itemId: 7,
    languageId: 2,
    locale: "pl",
    publishedAt: null,
    status: "draft",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    values: { body: null, slug: "witaj", summary: null, title: "Witaj" },
    version: 1,
    ...overrides,
  }) as never;

/** The repository, mocked to whatever the case under test needs. */
const translations = () => {
  const model = {
    create: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    findByLanguageId: vi.fn(),
    findByLocale: vi.fn(),
    findManyForItem: vi.fn(),
    publish: vi.fn(),
    resolveDefaultLanguage: vi.fn(),
    resolveLanguage: vi.fn((locale: string) =>
      language(locale, locale === "en" ? 1 : 2),
    ),
    unpublish: vi.fn(),
    update: vi.fn(),
  };

  return model as unknown as ContentTranslationModel<
    typeof testLocalizedGuideContentType
  > &
    typeof model;
};

const service = (model: ReturnType<typeof translations>) => {
  const schemas = testLocalizedGuideContentType.schemas.translation;
  if (!schemas) throw new Error("fixture is not localized");

  return createContentTranslationEditorialService({
    // Only `transaction` is reached: every method under test either takes a `tx`
    // or opens one, and nothing here queries.
    c: {
      get: () => ({
        transaction: async <T>(body: (tx: unknown) => Promise<T>) =>
          await body({}),
      }),
    } as never,
    definition: testLocalizedGuideContentType,
    pluginId: PLUGIN_ID,
    schemas,
    translations: model,
  });
};

beforeEach(() => {
  captured.length = 0;
  nextRevisionId = 100;
  storedRevision = null;
  revisionLanguageId = 1;
});

describe("create", () => {
  it("writes one `create` revision scoped to the locale", async () => {
    const model = translations();
    model.create.mockResolvedValue(row());

    const outcome = await service(model).create(
      7,
      "pl",
      { title: "Witaj" },
      { actor: ACTOR },
    );

    expect(outcome.changed).toBe(true);
    expect(outcome.locale).toBe("pl");
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      itemId: 7,
      languageId: 2,
      operation: "create",
      version: 1,
    });
  });

  it("snapshots the localized fields only", async () => {
    const model = translations();
    model.create.mockResolvedValue(row());

    await service(model).create(
      7,
      "pl",
      { title: "Witaj" },
      {
        actor: ACTOR,
      },
    );

    // `featured` is shared. A translation snapshot that carried it would let a
    // restore performed with `can_translate` rewrite it.
    expect(Object.keys(captured[0].snapshot.fields)).toEqual([
      "title",
      "slug",
      "body",
      "summary",
    ]);
    expect(captured[0].snapshot.locale).toBe("pl");
  });

  it("reports every localized field as changed", async () => {
    const model = translations();
    model.create.mockResolvedValue(row());

    const outcome = await service(model).create(
      7,
      "pl",
      { title: "Witaj" },
      { actor: ACTOR },
    );

    expect(outcome.changedFields).toEqual(["title", "slug", "body", "summary"]);
  });
});

describe("update", () => {
  it("writes one `update` revision and carries the previous slug", async () => {
    const model = translations();
    model.findByLocale.mockResolvedValue(row({ values: { slug: "stary" } }));
    model.update.mockResolvedValue({
      changed: true,
      changedFields: ["title", "slug"],
      row: row({ values: { slug: "nowy", title: "Nowy" }, version: 2 }),
      version: 2,
    });

    const outcome = await service(model).update(
      7,
      "pl",
      { title: "Nowy" },
      { actor: ACTOR, expectedVersion: 1 },
    );

    expect(outcome?.previousSlug).toBe("stary");
    expect(outcome?.version).toBe(2);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("update");
  });

  it("writes nothing at all for a no-op", async () => {
    const model = translations();
    model.findByLocale.mockResolvedValue(row());
    model.update.mockResolvedValue({
      changed: false,
      changedFields: [],
      row: row(),
      version: 1,
    });

    const outcome = await service(model).update(
      7,
      "pl",
      { title: "Witaj" },
      { actor: ACTOR, expectedVersion: 1 },
    );

    expect(outcome?.changed).toBe(false);
    expect(outcome?.revisionId).toBeNull();
    expect(captured).toHaveLength(0);
  });

  it("returns null when the locale has no translation", async () => {
    const model = translations();
    model.findByLocale.mockResolvedValue(null);
    model.update.mockResolvedValue(null);

    expect(
      await service(model).update(
        7,
        "pl",
        { title: "X" },
        {
          actor: ACTOR,
          expectedVersion: 1,
        },
      ),
    ).toBeNull();
  });
});

describe("delete", () => {
  it("records the version the row would have had", async () => {
    const model = translations();
    model.delete.mockResolvedValue(row({ version: 4 }));

    const outcome = await service(model).delete(7, "pl", {
      actor: ACTOR,
      expectedVersion: 4,
    });

    // 5, not 4: the row is gone, so nothing holds version 4 any more - and the
    // partial unique index would reject a second revision claiming it.
    expect(outcome?.version).toBe(5);
    expect(captured[0]).toMatchObject({ operation: "delete", version: 5 });
  });
});

describe("publish and unpublish", () => {
  it("writes a `publish` revision for a real transition", async () => {
    const model = translations();
    model.publish.mockResolvedValue({
      changed: true,
      row: row({ publishedAt: new Date(), status: "published", version: 2 }),
      version: 2,
    });

    const outcome = await service(model).publish(7, "pl", { actor: ACTOR });

    expect(outcome?.changed).toBe(true);
    expect(captured[0]).toMatchObject({ operation: "publish", version: 2 });
    expect(captured[0].snapshot.publication?.status).toBe("published");
  });

  it("writes nothing for an already published translation", async () => {
    const model = translations();
    model.publish.mockResolvedValue({
      changed: false,
      row: row({ status: "published" }),
      version: 1,
    });

    const outcome = await service(model).publish(7, "pl", { actor: ACTOR });

    expect(outcome?.changed).toBe(false);
    expect(outcome?.revisionId).toBeNull();
    expect(captured).toHaveLength(0);
  });

  it("passes an optional expectedVersion straight through", async () => {
    const model = translations();
    model.unpublish.mockResolvedValue({
      changed: true,
      row: row({ version: 3 }),
      version: 3,
    });

    await service(model).unpublish(7, "pl", {
      actor: ACTOR,
      expectedVersion: 2,
    });

    expect(model.unpublish).toHaveBeenCalledWith(7, "pl", {
      expectedVersion: 2,
      tx: expect.anything(),
    });
  });
});

describe("restore", () => {
  const snapshot = (
    fields: Record<string, unknown>,
  ): ContentTranslationRevisionSnapshot =>
    ({
      contentTypeId: testLocalizedGuideContentType.id,
      createdAt: "2026-01-01T00:00:00.000Z",
      fields,
      itemId: 7,
      languageId: 1,
      locale: "en",
      schemaVersion: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    }) as ContentTranslationRevisionSnapshot;

  it("restores one locale's values and creates a new version", async () => {
    const model = translations();
    storedRevision = snapshot({ title: "Old title" });
    model.findByLanguageId.mockResolvedValue(
      row({ languageId: 1, locale: "en", values: { title: "New title" } }),
    );
    model.update.mockResolvedValue({
      changed: true,
      changedFields: ["title"],
      row: row({
        languageId: 1,
        locale: "en",
        values: { title: "Old title" },
        version: 5,
      }),
      version: 5,
    });

    const outcome = await service(model).restore(7, "en", 42, {
      actor: ACTOR,
      expectedVersion: 4,
    });

    // Forward to a new version, not back to the historical one.
    expect(outcome?.version).toBe(5);
    expect(outcome?.restoredFromRevisionId).toBe(42);
    expect(captured[0]).toMatchObject({
      operation: "restore",
      restoredFromRevisionId: 42,
    });
  });

  it("refuses a revision belonging to another locale", async () => {
    const model = translations();
    storedRevision = snapshot({ title: "Old title" });
    // The stored revision belongs to language 1; the request is for `pl`, which
    // resolves to 2 - so the scoped read finds nothing.
    revisionLanguageId = 1;

    expect(
      await service(model).restore(7, "pl", 42, {
        actor: ACTOR,
        expectedVersion: 1,
      }),
    ).toBeNull();
    expect(model.update).not.toHaveBeenCalled();
  });

  it("never restores shared fields", async () => {
    const model = translations();
    // A snapshot that somehow carries a shared field - a hand-edited row, or one
    // written before the partition existed.
    storedRevision = snapshot({ featured: true, title: "Old title" });
    model.findByLanguageId.mockResolvedValue(
      row({ languageId: 1, locale: "en", values: { title: "New" } }),
    );
    model.update.mockResolvedValue({
      changed: true,
      changedFields: ["title"],
      row: row({ languageId: 1, locale: "en", version: 2 }),
      version: 2,
    });

    await service(model).restore(7, "en", 42, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    const [, , patch] = model.update.mock.calls[0] as [
      number,
      string,
      Record<string, unknown>,
    ];
    expect(patch).not.toHaveProperty("featured");
    expect(patch).toHaveProperty("title", "Old title");
  });

  it("rejects a snapshot missing a now-required localized field", async () => {
    const model = translations();
    // `title` is required, and an empty patch fails the "at least one field"
    // refinement - so the restore is refused before anything is written.
    storedRevision = snapshot({});
    model.findByLanguageId.mockResolvedValue(
      row({ languageId: 1, locale: "en" }),
    );

    await expect(
      service(model).restore(7, "en", 42, {
        actor: ACTOR,
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ContentRevisionNotRestorable);
    expect(model.update).not.toHaveBeenCalled();
  });

  it("writes nothing when the values already match", async () => {
    const model = translations();
    storedRevision = snapshot({ title: "Same" });
    model.findByLanguageId.mockResolvedValue(
      row({ languageId: 1, locale: "en", values: { title: "Same" } }),
    );

    const outcome = await service(model).restore(7, "en", 42, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    expect(outcome?.changed).toBe(false);
    expect(outcome?.restoredFromRevisionId).toBeNull();
    expect(captured).toHaveLength(0);
  });

  it("never moves publication state", async () => {
    const model = translations();
    storedRevision = {
      ...snapshot({ title: "Old" }),
      publication: { publishedAt: null, status: "draft" },
    };
    model.findByLanguageId.mockResolvedValue(
      row({
        languageId: 1,
        locale: "en",
        status: "published",
        values: { title: "New" },
      }),
    );
    model.update.mockResolvedValue({
      changed: true,
      changedFields: ["title"],
      row: row({
        languageId: 1,
        locale: "en",
        status: "published",
        version: 2,
      }),
      version: 2,
    });

    await service(model).restore(7, "en", 42, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    const [, , patch] = model.update.mock.calls[0] as [
      number,
      string,
      Record<string, unknown>,
    ];
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("publishedAt");
    expect(model.publish).not.toHaveBeenCalled();
    expect(model.unpublish).not.toHaveBeenCalled();
  });
});

describe("history reads", () => {
  it("resolves the locale without requiring it to be enabled", async () => {
    const model = translations();

    await service(model).listRevisions(7, "de");

    // Reading the history of a switched-off language is exactly what somebody
    // auditing it would want to do.
    expect(model.resolveLanguage).toHaveBeenCalledWith("de", {
      requireEnabled: false,
      tx: undefined,
    });
  });

  it("returns null for a revision id outside this locale", async () => {
    const model = translations();
    storedRevision = null;

    expect(await service(model).findRevision(7, "en", 42)).toBeNull();
  });
});

describe("configuration guards", () => {
  it("refuses a content type without editorial", () => {
    const schemas = testLocalizedGuideContentType.schemas.translation;
    if (!schemas) throw new Error("fixture is not localized");

    expect(() =>
      createContentTranslationEditorialService({
        c: {} as never,
        definition: {
          ...testLocalizedGuideContentType,
          editorial: {
            ...testLocalizedGuideContentType.editorial,
            enabled: false,
          },
        } as never,
        pluginId: PLUGIN_ID,
        schemas,
        translations: translations(),
      }),
    ).toThrow(/needs `editorial: \{ enabled: true \}`/);
  });
});
