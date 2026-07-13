// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { core_languages_words } from "@/database/languages";

import { saveLanguageWords } from "./save-language-words";

const createDbMock = () => {
  const insertValues = vi.fn();
  const where = vi.fn();
  const tx = {
    delete: vi.fn(() => ({ where })),
    insert: vi.fn(() => ({ values: insertValues })),
  };
  const db = {
    transaction: vi.fn(async (cb: (t: typeof tx) => Promise<void>) => cb(tx)),
  };

  return { db, tx, insertValues, where };
};

const createContext = (db: unknown): Context =>
  ({ get: (key: string) => (key === "db" ? db : undefined) }) as Context;

describe("saveLanguageWords", () => {
  it("replaces the tuple rows: delete then insert the mapped values", async () => {
    const { db, tx, insertValues } = createDbMock();

    await saveLanguageWords(createContext(db), {
      pluginCode: "blog",
      tableName: "blog_categories",
      variable: "name",
      itemId: 7,
      values: [
        { languageCode: "en", value: "News" },
        { languageCode: "pl", value: "Aktualności" },
      ],
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(tx.delete).toHaveBeenCalledWith(core_languages_words);
    expect(tx.insert).toHaveBeenCalledWith(core_languages_words);
    expect(insertValues).toHaveBeenCalledWith([
      {
        languageCode: "en",
        pluginCode: "blog",
        itemId: 7,
        value: "News",
        tableName: "blog_categories",
        variable: "name",
      },
      {
        languageCode: "pl",
        pluginCode: "blog",
        itemId: 7,
        value: "Aktualności",
        tableName: "blog_categories",
        variable: "name",
      },
    ]);
  });

  it("deletes but does not insert when values is empty", async () => {
    const { db, tx, insertValues } = createDbMock();

    await saveLanguageWords(createContext(db), {
      pluginCode: "blog",
      tableName: "blog_categories",
      variable: "name",
      itemId: 7,
      values: [],
    });

    expect(tx.delete).toHaveBeenCalledOnce();
    expect(tx.insert).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });
});
