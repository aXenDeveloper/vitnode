// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { testLocalizedGuideContentType } from "@/tests/content-fixtures";
import { createTestRevisionsTable } from "@/tests/revisions-table";

import type { ContentTranslationRevisionSnapshot } from "../revisions";
import type { ContentTranslationModel } from "./translation-model";

import { ContentRevisionNotRestorable } from "../errors";
import { createContentTranslationEditorialService } from "./translation-editorial-service";
import { CONTENT_TRANSLATION_INITIAL_VERSION } from "./translation-model";

const PLUGIN_ID = "@vitnode/example";
const ACTOR = { type: "staff" as const, userId: 1 };

let revisions = createTestRevisionsTable();

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
    findManyRowsForItems: vi.fn().mockResolvedValue([]),
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
    c: {
      get: (key: string) => (key === "db" ? revisions.db : undefined),
    } as unknown as Context,
    definition: testLocalizedGuideContentType,
    pluginId: PLUGIN_ID,
    schemas,
    translations: model,
  });
};

beforeEach(() => {
  revisions = createTestRevisionsTable();
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
    expect(revisions.written).toHaveLength(1);
    expect(revisions.written[0]).toMatchObject({
      itemId: 7,
      languageId: 2,
      operation: "create",
      version: 1,
    });
  });

  it("starts a fresh locale at version 1", async () => {
    const model = translations();
    model.create.mockResolvedValue(row());

    await service(model).create(7, "pl", { title: "Witaj" }, { actor: ACTOR });

    const options = model.create.mock.calls[0][3] as Record<symbol, unknown>;
    expect(options[CONTENT_TRANSLATION_INITIAL_VERSION]).toBe(1);
  });

  it("resumes a recreated locale after its last recorded version", async () => {
    // The Polish translation was created, edited and deleted: the delete revision
    // holds version 3. Recreating it at 1 would collide with the `create`
    // revision from its first life, because the history was never removed.
    revisions.seed({ languageId: 2, version: 3 });

    const model = translations();
    model.create.mockResolvedValue(row({ version: 4 }));

    const outcome = await service(model).create(
      7,
      "pl",
      { title: "Witaj" },
      { actor: ACTOR },
    );

    const options = model.create.mock.calls[0][3] as Record<symbol, unknown>;
    expect(options[CONTENT_TRANSLATION_INITIAL_VERSION]).toBe(4);
    expect(revisions.written[0]).toMatchObject({
      operation: "create",
      version: 4,
    });
    expect(outcome.version).toBe(4);
  });

  it("reads the history of the locale being created, not of another", async () => {
    // English reached version 9; Polish has never existed. A shared counter would
    // start the Polish translation at 10 and leave a hole nothing explains.
    revisions.seed({ languageId: 1, version: 9 });

    const model = translations();
    model.create.mockResolvedValue(row());

    await service(model).create(7, "pl", { title: "Witaj" }, { actor: ACTOR });

    const options = model.create.mock.calls[0][3] as Record<symbol, unknown>;
    expect(options[CONTENT_TRANSLATION_INITIAL_VERSION]).toBe(1);
  });

  it("resolves the language itself, and requires an enabled one", async () => {
    const model = translations();
    model.create.mockResolvedValue(row());

    await service(model).create(7, "PL", { title: "Witaj" }, { actor: ACTOR });

    // Resolved once, here, and inside the transaction: the history read and the
    // insert have to be talking about the same language id, and the read has to
    // see what the transaction will.
    expect(model.resolveLanguage).toHaveBeenCalledWith("PL", {
      requireEnabled: true,
      tx: expect.anything(),
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
    // restore of one language rewrite it.
    expect(Object.keys(revisions.written[0].snapshot.fields)).toEqual([
      "title",
      "slug",
      "body",
      "summary",
    ]);
    expect(revisions.written[0].snapshot.locale).toBe("pl");
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
    expect(revisions.written).toHaveLength(1);
    expect(revisions.written[0].operation).toBe("update");
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
    expect(revisions.written).toHaveLength(0);
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
    expect(revisions.written[0]).toMatchObject({
      operation: "delete",
      version: 5,
    });
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
    expect(revisions.written[0]).toMatchObject({
      operation: "publish",
      version: 2,
    });
    expect(revisions.written[0].snapshot.publication?.status).toBe("published");
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
    expect(revisions.written).toHaveLength(0);
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
    revisions.seed({
      languageId: 1,
      snapshot: snapshot({ title: "Old title" }),
      version: 1,
    });
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
    expect(revisions.written[0]).toMatchObject({
      languageId: 1,
      operation: "restore",
      restoredFromRevisionId: 42,
    });
  });

  it("refuses a revision belonging to another locale", async () => {
    const model = translations();
    // The stored revision belongs to language 1; the request is for `pl`, which
    // resolves to 2 - so the scoped read finds nothing.
    revisions.seed({
      languageId: 1,
      snapshot: snapshot({ title: "Old title" }),
      version: 1,
    });

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
    revisions.seed({
      languageId: 1,
      snapshot: snapshot({ featured: true, title: "Old title" }),
      version: 1,
    });
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
    revisions.seed({ languageId: 1, snapshot: snapshot({}), version: 1 });
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
    revisions.seed({
      languageId: 1,
      snapshot: snapshot({ title: "Same" }),
      version: 1,
    });
    model.findByLanguageId.mockResolvedValue(
      row({ languageId: 1, locale: "en", values: { title: "Same" } }),
    );

    const outcome = await service(model).restore(7, "en", 42, {
      actor: ACTOR,
      expectedVersion: 1,
    });

    expect(outcome?.changed).toBe(false);
    expect(outcome?.restoredFromRevisionId).toBeNull();
    expect(revisions.written).toHaveLength(0);
  });

  it("never moves publication state", async () => {
    const model = translations();
    revisions.seed({
      languageId: 1,
      snapshot: {
        ...snapshot({ title: "Old" }),
        publication: { publishedAt: null, status: "draft" },
      },
      version: 1,
    });
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
    revisions.seed({ languageId: 2, version: 1 });

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
