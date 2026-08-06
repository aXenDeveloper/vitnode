// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { testLocalizedArticleContentType } from "@/tests/content-fixtures";

import {
  ContentDefaultTranslationRequired,
  ContentInputError,
  ContentLanguageError,
  ContentTranslationExists,
  ContentTranslationItemMissing,
  ContentTranslationVersionConflict,
} from "../errors";
import { createContentModel } from "./model";

const localized = createContentModel(testLocalizedArticleContentType);

const LANGUAGES = [
  { code: "en", id: 1, isDefault: true },
  { code: "pl", id: 2, isDefault: false },
];

interface RecordedCall {
  arg: unknown;
  op: string;
}

/**
 * A chainable stand-in for the Drizzle client, in the same shape
 * `service.test.ts` uses.
 *
 * The first `select().from()` of a request is the language registry, so it is
 * answered from `LANGUAGES` rather than from the queue - which keeps every test
 * below queueing only the rows it actually cares about.
 */
const createDbMock = (results: unknown[][], languages = LANGUAGES) => {
  const calls: RecordedCall[] = [];
  const queue = [...results];

  const chain = (rows: unknown[]) => {
    const record = (op: string, arg: unknown) => {
      calls.push({ arg, op });

      return builder;
    };

    const builder = {
      $dynamic: () => builder,
      // Always the builder, which is itself thenable: `await select().from()`
      // (how the language registry is read) resolves through `then` below, and a
      // longer chain keeps building.
      from: (value: unknown) => record("from", value),
      leftJoin: (value: unknown) => record("leftJoin", value),
      limit: (value: unknown) => record("limit", value),
      onConflictDoNothing: (value: unknown) =>
        record("onConflictDoNothing", value),
      orderBy: (value: unknown) => record("orderBy", value),
      returning: (value: unknown) => record("returning", value),
      set: (value: unknown) => record("set", value),
      then: async <TResult>(resolve: (rows: unknown[]) => TResult) =>
        Promise.resolve(rows).then(resolve),
      values: (value: unknown) => record("values", value),
      where: (value: unknown) => record("where", value),
    };

    return builder;
  };

  const start = (op: string) => (arg: unknown) => {
    calls.push({ arg, op });
    // The language registry is the one `select` whose projection names `code`
    // and `isDefault`, so it is answered from `languages` rather than from the
    // queue - which keeps every test queueing only the rows it cares about.
    const isLanguageSelect =
      op === "select" &&
      typeof arg === "object" &&
      arg !== null &&
      "code" in arg &&
      "isDefault" in arg;

    return chain(isLanguageSelect ? languages : (queue.shift() ?? []));
  };

  const db = {
    delete: start("delete"),
    insert: start("insert"),
    select: start("select"),
    transaction: async <TResult>(
      body: (tx: unknown) => Promise<TResult>,
    ): Promise<TResult> => await body(db),
    update: start("update"),
  };

  const c = {
    get: (key: string) => (key === "db" ? db : undefined),
  } as unknown as Context;

  return { c, calls };
};

const opsOf = (calls: RecordedCall[], op: string) =>
  calls.filter(call => call.op === op).map(call => call.arg);

const translationRow = (overrides: Record<string, unknown> = {}) => ({
  body: "Body",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  itemId: 7,
  languageId: 1,
  slug: "hello",
  title: "Hello",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  version: 1,
  ...overrides,
});

/**
 * The translation model, narrowed once.
 *
 * `translationService` is `undefined` without localization, so TypeScript refuses
 * the call until the check has been made.
 */
const translations = (c: Context) => {
  const build = localized.translationService;
  if (!build) throw new Error("Expected a translation service.");

  return build(c);
};

describe("create", () => {
  it("writes the resolved language id and starts at version 1", async () => {
    const { c, calls } = createDbMock([
      [{ id: 7 }],
      [translationRow({ version: 1 })],
    ]);

    const row = await translations(c).create(7, "en", { title: "Hello" });

    expect(row.version).toBe(1);
    expect(row.locale).toBe("en");
    expect(row.itemId).toBe(7);
    // `version` is never written: the column default is what makes it 1, and the
    // conditional UPDATE is the only thing that ever moves it.
    expect(opsOf(calls, "values")[0]).toEqual({
      itemId: 7,
      languageId: 1,
      slug: "hello",
      title: "Hello",
    });
  });

  it("nests the localized values under `values`", async () => {
    const { c } = createDbMock([[{ id: 7 }], [translationRow()]]);

    const row = await translations(c).create(7, "en", { title: "Hello" });

    expect(row.values).toEqual({
      body: "Body",
      slug: "hello",
      title: "Hello",
    });
    // Metadata sits beside the values, never inside them.
    expect(row.values).not.toHaveProperty("version");
  });

  it("derives a localized slug from the localized title", async () => {
    const { c, calls } = createDbMock([[{ id: 7 }], [translationRow()]]);

    await translations(c).create(7, "pl", { title: "Witaj Świecie" });

    expect(opsOf(calls, "values")[0]).toMatchObject({
      languageId: 2,
      slug: "witaj-swiecie",
    });
  });

  it("normalises a supplied slug rather than trusting it", async () => {
    const { c, calls } = createDbMock([[{ id: 7 }], [translationRow()]]);

    await translations(c).create(7, "en", {
      slug: "Hello  World!",
      title: "Hello",
    });

    expect(opsOf(calls, "values")[0]).toMatchObject({ slug: "hello-world" });
  });

  it("refuses a slug that normalises to nothing", async () => {
    const { c } = createDbMock([[{ id: 7 }]]);

    await expect(
      translations(c).create(7, "en", { title: "日本語のタイトル" }),
    ).rejects.toBeInstanceOf(ContentInputError);
  });

  it("validates the payload before writing", async () => {
    const { c } = createDbMock([[{ id: 7 }]]);

    await expect(
      translations(c).create(7, "en", { title: "no" }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("refuses a translation for a record that is not there", async () => {
    const { c } = createDbMock([[]]);

    await expect(
      translations(c).create(99, "en", { title: "Hello" }),
    ).rejects.toBeInstanceOf(ContentTranslationItemMissing);
  });

  it("refuses an unknown locale", async () => {
    const { c } = createDbMock([]);

    await expect(
      translations(c).create(7, "de", { title: "Hello" }),
    ).rejects.toMatchObject({ reason: "missing" });
  });

  it("reports a locale that already has a translation", async () => {
    const { c } = createDbMock([[{ id: 7 }], []]);

    await expect(
      translations(c).create(7, "en", { title: "Hello" }),
    ).rejects.toBeInstanceOf(ContentTranslationExists);
  });

  it("targets the primary key so a slug clash still surfaces", async () => {
    const { c, calls } = createDbMock([[{ id: 7 }], [translationRow()]]);

    await translations(c).create(7, "en", { title: "Hello" });

    // An untargeted `onConflictDoNothing()` would swallow the unique slug index
    // too, and report "this locale exists" for a URL that is taken.
    expect(opsOf(calls, "onConflictDoNothing")).toHaveLength(1);
  });
});

describe("update", () => {
  it("guards on the expected version and increments it", async () => {
    const { c, calls } = createDbMock([
      [translationRow({ version: 3 })],
      [translationRow({ title: "New", version: 4 })],
    ]);

    const result = await translations(c).update(
      7,
      "en",
      { title: "New" },
      { expectedVersion: 3 },
    );

    expect(result).toMatchObject({ changed: true, version: 4 });
    expect(result?.changedFields).toEqual(["title"]);
    const [values] = opsOf(calls, "set");
    expect(values).toHaveProperty("title", "New");
    expect(values).toHaveProperty("version");
  });

  it("writes only the fields that actually changed", async () => {
    const { c, calls } = createDbMock([
      [translationRow({ version: 1 })],
      [translationRow({ title: "New", version: 2 })],
    ]);

    await translations(c).update(
      7,
      "en",
      { body: "Body", title: "New" },
      { expectedVersion: 1 },
    );

    // `body` was already "Body", so it is not part of the write.
    expect(Object.keys(opsOf(calls, "set")[0] as object).sort()).toEqual([
      "title",
      "version",
    ]);
  });

  it("does nothing at all for a no-op", async () => {
    const { c, calls } = createDbMock([[translationRow({ version: 5 })]]);

    const result = await translations(c).update(
      7,
      "en",
      { title: "Hello" },
      { expectedVersion: 5 },
    );

    expect(result).toMatchObject({ changed: false, version: 5 });
    expect(result?.changedFields).toEqual([]);
    // No UPDATE, so no version bump and no `updatedAt` move: an editor who
    // pressed save twice has not created two versions of anything.
    expect(opsOf(calls, "update")).toEqual([]);
  });

  it("treats a re-sent slug in a different case as a no-op", async () => {
    const { c, calls } = createDbMock([[translationRow({ version: 2 })]]);

    const result = await translations(c).update(
      7,
      "en",
      { slug: "HELLO" },
      { expectedVersion: 2 },
    );

    expect(result?.changed).toBe(false);
    expect(opsOf(calls, "update")).toEqual([]);
  });

  it("does not check the version on a no-op", async () => {
    const { c } = createDbMock([[translationRow({ version: 9 })]]);

    // There is nothing to overwrite, so there is nothing to conflict about.
    const result = await translations(c).update(
      7,
      "en",
      { title: "Hello" },
      { expectedVersion: 2 },
    );

    expect(result?.changed).toBe(false);
  });

  it("throws a version conflict when the row moved", async () => {
    const { c } = createDbMock([
      [translationRow({ version: 2 })],
      [],
      [translationRow({ version: 4 })],
    ]);

    await expect(
      translations(c).update(7, "en", { title: "New" }, { expectedVersion: 2 }),
    ).rejects.toMatchObject({
      currentVersion: 4,
      expectedVersion: 2,
      itemId: 7,
      locale: "en",
    });
  });

  it("names the locale in the conflict, never the other language", async () => {
    const { c } = createDbMock([
      [translationRow({ languageId: 2, version: 2 })],
      [],
      [translationRow({ languageId: 2, version: 3 })],
    ]);

    const error = await translations(c)
      .update(7, "pl", { title: "Nowy" }, { expectedVersion: 2 })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ContentTranslationVersionConflict);
    expect(error).toMatchObject({ locale: "pl" });
  });

  it("returns null when the translation is missing", async () => {
    const { c } = createDbMock([[]]);

    expect(
      await translations(c).update(
        7,
        "en",
        { title: "New" },
        { expectedVersion: 1 },
      ),
    ).toBeNull();
  });

  it("refuses to write into a disabled language", async () => {
    const { c } = createDbMock([]);
    const context = {
      get: (key: string) =>
        key === "core"
          ? { i18n: { locales: [{ code: "pl", enabled: false, name: "PL" }] } }
          : c.get(key),
    } as unknown as Context;

    await expect(
      translations(context).update(
        7,
        "pl",
        { title: "Nowy" },
        { expectedVersion: 1 },
      ),
    ).rejects.toMatchObject({ reason: "disabled" });
  });
});

describe("delete", () => {
  it("guards on the expected version", async () => {
    const { c } = createDbMock([
      [translationRow({ languageId: 2, version: 3 })],
    ]);

    const row = await translations(c).delete(7, "pl", { expectedVersion: 3 });

    expect(row).toMatchObject({ itemId: 7, locale: "pl", version: 3 });
  });

  it("throws a version conflict when the row moved", async () => {
    const { c } = createDbMock([
      [],
      [translationRow({ languageId: 2, version: 5 })],
    ]);

    await expect(
      translations(c).delete(7, "pl", { expectedVersion: 3 }),
    ).rejects.toMatchObject({ currentVersion: 5, expectedVersion: 3 });
  });

  it("returns null when the translation is already gone", async () => {
    const { c } = createDbMock([[], []]);

    // The caller wanted it removed, and it is.
    expect(
      await translations(c).delete(7, "pl", { expectedVersion: 3 }),
    ).toBeNull();
  });

  it("refuses to delete the default translation", async () => {
    const { c, calls } = createDbMock([]);

    await expect(
      translations(c).delete(7, "en", { expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ContentDefaultTranslationRequired);
    // Refused before anything is issued: the invariant atomic create establishes
    // is not something a DELETE gets to test.
    expect(opsOf(calls, "delete")).toEqual([]);
  });

  it("refuses the default translation whatever the casing", async () => {
    const { c } = createDbMock([]);

    await expect(
      translations(c).delete(7, "EN", { expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ContentDefaultTranslationRequired);
  });

  it("allows deleting a translation in a disabled language", async () => {
    const { c } = createDbMock([
      [translationRow({ languageId: 2, version: 1 })],
    ]);
    const context = {
      get: (key: string) =>
        key === "core"
          ? { i18n: { locales: [{ code: "pl", enabled: false, name: "PL" }] } }
          : c.get(key),
    } as unknown as Context;

    // Removing content in a language the install has switched off is exactly
    // what somebody would want to do next.
    expect(
      await translations(context).delete(7, "pl", { expectedVersion: 1 }),
    ).toMatchObject({ locale: "pl" });
  });
});

describe("reads", () => {
  it("finds one translation by locale", async () => {
    const { c } = createDbMock([[translationRow()]]);

    expect(await translations(c).findByLocale(7, "EN")).toMatchObject({
      // The canonical locale, not the caller's casing.
      locale: "en",
      version: 1,
    });
  });

  it("finds one translation by language id", async () => {
    const { c } = createDbMock([[translationRow({ languageId: 2 })]]);

    expect(await translations(c).findByLanguageId(7, 2)).toMatchObject({
      languageId: 2,
      locale: "pl",
    });
  });

  it("returns null for an unknown locale rather than throwing", async () => {
    const { c } = createDbMock([]);

    expect(await translations(c).findByLocale(7, "de")).toBeNull();
  });

  it("lists metadata without any localized value", async () => {
    const { c } = createDbMock([
      [
        {
          createdAt: new Date(),
          itemId: 7,
          languageId: 1,
          updatedAt: new Date(),
          version: 2,
        },
        {
          createdAt: new Date(),
          itemId: 7,
          languageId: 2,
          updatedAt: new Date(),
          version: 1,
        },
      ],
    ]);

    const edges = await translations(c).findManyForItem(7);

    expect(edges.map(edge => edge.locale)).toEqual(["en", "pl"]);
    expect(edges[0]).not.toHaveProperty("values");
    expect(edges[0]).not.toHaveProperty("title");
  });

  it("resolves every locale in a list without a query per row", async () => {
    const { c, calls } = createDbMock([
      Array.from({ length: 2 }, (_unused, index) => ({
        createdAt: new Date(),
        itemId: 7,
        languageId: index + 1,
        updatedAt: new Date(),
        version: 1,
      })),
    ]);

    await translations(c).findManyForItem(7);

    // One select for the rows, one for the language registry. Never one per
    // translation.
    expect(opsOf(calls, "select")).toHaveLength(2);
  });

  it("answers `exists` without loading the values", async () => {
    const { c, calls } = createDbMock([[{ itemId: 7 }]]);

    expect(await translations(c).exists(7, "en")).toBe(true);
    expect(Object.keys(opsOf(calls, "select")[1] as object)).toEqual([
      "itemId",
    ]);
  });

  it("answers `exists` false for an unknown locale", async () => {
    const { c } = createDbMock([]);

    expect(await translations(c).exists(7, "de")).toBe(false);
  });

  it("resolves the default language", async () => {
    const { c } = createDbMock([]);

    expect(await translations(c).resolveDefaultLanguage()).toMatchObject({
      id: 1,
      isDefault: true,
      locale: "en",
    });
  });

  it("throws when the default language is gone", async () => {
    const { c } = createDbMock([], [{ code: "pl", id: 2, isDefault: true }]);

    await expect(
      translations(c).resolveDefaultLanguage(),
    ).rejects.toBeInstanceOf(ContentLanguageError);
  });
});
