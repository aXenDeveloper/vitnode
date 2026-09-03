// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import {
  testLocalizedArticleContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { ContentEngineError, ContentLanguageError } from "../errors";
import { createContentModel } from "./model";

const localized = createContentModel(testLocalizedArticleContentType);

const localizedService = (c: Context) => {
  const build = localized.localizedService;
  if (!build) throw new Error("Expected a localized service.");

  return build(c);
};

const LANGUAGES = [
  { code: "en", id: 1, isDefault: true },
  { code: "pl", id: 2, isDefault: false },
];

interface RecordedCall {
  arg: unknown;
  op: string;
}

const createDbMock = (
  results: unknown[][],
  {
    failInsert,
    languages = LANGUAGES,
  }: {
    /** 1-based insert whose `returning()` throws, standing in for a driver error. */
    failInsert?: number;
    languages?: typeof LANGUAGES;
  } = {},
) => {
  const calls: RecordedCall[] = [];
  const queue = [...results];
  const state = { committed: false, entered: false, rolledBack: false };
  let inserts = 0;
  const chain = (rows: unknown[], failReturning = false) => {
    const record = (op: string, arg: unknown) => {
      calls.push({ arg, op });

      return builder;
    };

    const builder = {
      // Always the builder, which is itself thenable: `await select().from()`
      // (how the language registry is read) resolves through `then` below, and a
      // longer chain keeps building.
      from: (value: unknown) => record("from", value),
      limit: (value: unknown) => record("limit", value),
      onConflictDoNothing: (value: unknown) =>
        record("onConflictDoNothing", value),
      orderBy: (value: unknown) => record("orderBy", value),
      returning: (value: unknown) => {
        if (failReturning) {
          throw Object.assign(new Error("duplicate key value"), {
            code: "23505",
          });
        }

        return record("returning", value);
      },
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

    if (op === "insert") inserts += 1;

    return chain(
      isLanguageSelect ? languages : (queue.shift() ?? []),
      op === "insert" && inserts === failInsert,
    );
  };

  const db = {
    delete: start("delete"),
    insert: start("insert"),
    select: start("select"),
    transaction: async <TResult>(
      body: (tx: unknown) => Promise<TResult>,
    ): Promise<TResult> => {
      state.entered = true;
      try {
        const result = await body(db);
        state.committed = true;

        return result;
      } catch (error) {
        state.rolledBack = true;
        throw error;
      }
    },
    update: start("update"),
  };

  const c = {
    get: (key: string) => (key === "db" ? db : undefined),
  } as unknown as Context;

  return { c, calls, state };
};

const opsOf = (calls: RecordedCall[], op: string) =>
  calls.filter(call => call.op === op).map(call => call.arg);

const baseRow = { createdAt: new Date(), featured: true, id: 7, views: 0 };
const translationRow = {
  body: null,
  createdAt: new Date(),
  itemId: 7,
  languageId: 1,
  slug: "hello",
  title: "Hello",
  updatedAt: new Date(),
  version: 1,
};

describe("localized create", () => {
  it("writes the base row and its default translation in one transaction", async () => {
    const { c, calls, state } = createDbMock([
      [baseRow],
      [{ id: 7 }],
      [translationRow],
    ]);

    const result = await localizedService(c).create({
      shared: { featured: true },
      translation: { title: "Hello" },
    });

    expect(state).toEqual({
      committed: true,
      entered: true,
      rolledBack: false,
    });
    expect(result.row.id).toBe(7);
    expect(result.translation).toMatchObject({
      itemId: 7,
      locale: "en",
      version: 1,
    });
    // Two inserts, one transaction. A record whose default translation lands in
    // a second request would be addressable and empty in every language until it
    // arrived - or forever, if the second request never came.
    expect(opsOf(calls, "insert")).toHaveLength(2);
  });

  it("separates the shared values from the localized ones", async () => {
    const { c, calls } = createDbMock([
      [baseRow],
      [{ id: 7 }],
      [translationRow],
    ]);

    await localizedService(c).create({
      shared: { featured: true },
      translation: { title: "Hello" },
    });

    const [base, translation] = opsOf(calls, "values") as Record<
      string,
      unknown
    >[];

    // The base insert never sees a localized value, and the translation insert
    // never sees a shared one.
    expect(base).toEqual({ featured: true, views: 0 });
    expect(translation).toEqual({
      itemId: 7,
      languageId: 1,
      slug: "hello",
      title: "Hello",
    });
  });

  it("defaults the locale to the configured default", async () => {
    const { c, calls } = createDbMock([
      [baseRow],
      [{ id: 7 }],
      [translationRow],
    ]);

    await localizedService(c).create({
      shared: {},
      translation: { title: "Hello" },
    });

    expect(opsOf(calls, "values")[1]).toMatchObject({ languageId: 1 });
  });

  it("accepts the default locale written out explicitly", async () => {
    const { c } = createDbMock([[baseRow], [{ id: 7 }], [translationRow]]);

    await expect(
      localizedService(c).create(
        { shared: {}, translation: { title: "Hello" } },
        { locale: "EN" },
      ),
    ).resolves.toMatchObject({ translation: { locale: "en" } });
  });

  it("refuses to create a record straight into another locale", async () => {
    const { c, state } = createDbMock([[baseRow]]);

    // Creating in Polish would leave the default translation missing - the one
    // thing the invariant promises is always there.
    await expect(
      localizedService(c).create(
        { shared: {}, translation: { title: "Witaj" } },
        { locale: "pl" },
      ),
    ).rejects.toBeInstanceOf(ContentEngineError);
    expect(state.entered).toBe(false);
  });

  it("rolls back when the translation insert fails", async () => {
    // The base insert succeeds, the translation's locale already exists.
    const { c, state } = createDbMock([[baseRow], [{ id: 7 }], []]);

    await expect(
      localizedService(c).create({
        shared: {},
        translation: { title: "Hello" },
      }),
    ).rejects.toThrow();
    expect(state.rolledBack).toBe(true);
    expect(state.committed).toBe(false);
  });

  it("rolls back when a localized slug is taken", async () => {
    // The second insert - the translation - hits the unique
    // `(languageId, slug)` index.
    const { c, state } = createDbMock([[baseRow], [{ id: 7 }]], {
      failInsert: 2,
    });

    await expect(
      localizedService(c).create({
        shared: {},
        translation: { title: "Hello" },
      }),
    ).rejects.toThrow(/duplicate key value/);
    expect(state.rolledBack).toBe(true);
    expect(state.committed).toBe(false);
  });

  it("rolls back the translation when the base insert fails", async () => {
    const { c, calls, state } = createDbMock([], { failInsert: 1 });

    await expect(
      localizedService(c).create({
        shared: {},
        translation: { title: "Hello" },
      }),
    ).rejects.toThrow(/duplicate key value/);
    // Never reached the translation at all, so there is nothing orphaned.
    expect(opsOf(calls, "insert")).toHaveLength(1);
    expect(state.committed).toBe(false);
  });

  it("creates nothing when the default language is gone", async () => {
    const { c, calls, state } = createDbMock([], {
      languages: [{ code: "pl", id: 2, isDefault: true }],
    });

    await expect(
      localizedService(c).create({
        shared: {},
        translation: { title: "Hello" },
      }),
    ).rejects.toBeInstanceOf(ContentLanguageError);
    // Resolved inside the transaction and *before* the base insert, so there is
    // no orphan row to clean up.
    expect(opsOf(calls, "insert")).toEqual([]);
    expect(state.committed).toBe(false);
  });

  it("joins a transaction the caller already owns", async () => {
    const { c, state } = createDbMock([
      [baseRow],
      [{ id: 7 }],
      [translationRow],
    ]);
    const tx = c.get("db") as never;

    await localizedService(c).create(
      { shared: {}, translation: { title: "Hello" } },
      { tx },
    );

    // No transaction of its own - the caller's is the one that commits.
    expect(state.entered).toBe(false);
  });
});

describe("a content type without localization", () => {
  it("has no localized service to call", () => {
    const posts = createContentModel(testPostContentType, {
      references: { category: () => posts.table.id },
    });

    expect(posts.localizedService).toBeUndefined();
  });
});
