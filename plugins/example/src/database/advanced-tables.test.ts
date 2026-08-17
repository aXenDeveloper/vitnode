import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  example_advanced_articles,
  example_advanced_articles_categories,
  example_advanced_articles_faq,
  example_advanced_articles_related_articles,
  example_advanced_articles_translations,
} from "./advanced-articles";

/**
 * What Stage 6 actually generates, read off Drizzle's own table metadata.
 *
 * The same shape of test `tables.test.ts` runs for the base and translation
 * tables, and for the same reason: the migration is generated from these
 * objects, so an assertion here is an assertion about the SQL - one that fails
 * at `pnpm test` rather than at `drizzle-kit generate` three commits later.
 */

const base = getTableConfig(example_advanced_articles);
const junction = getTableConfig(example_advanced_articles_categories);
const selfJunction = getTableConfig(example_advanced_articles_related_articles);
const faq = getTableConfig(example_advanced_articles_faq);

const translations = (() => {
  if (!example_advanced_articles_translations) {
    throw new Error("example.advanced-article generated no translation table.");
  }

  return getTableConfig(example_advanced_articles_translations);
})();

const columnNames = (config: { columns: { name: string }[] }): string[] =>
  config.columns.map(column => column.name).sort();

const indexNames = (config: {
  indexes: { config: { name?: string } }[];
}): string[] => config.indexes.map(item => item.config.name ?? "").sort();

describe("advanced article: generated tables", () => {
  it("names the collection tables after the field", () => {
    expect(getTableName(example_advanced_articles_categories)).toBe(
      "example_advanced_articles_categories",
    );
    expect(getTableName(example_advanced_articles_related_articles)).toBe(
      "example_advanced_articles_related_articles",
    );
    expect(getTableName(example_advanced_articles_faq)).toBe(
      "example_advanced_articles_faq",
    );
  });

  it("flattens a shared group into columns on the base table", () => {
    expect(columnNames(base)).toContain("syndicationIndexable");
    expect(columnNames(base)).toContain("syndicationPriority");
    // The group itself is not a column, and neither collection is either.
    expect(columnNames(base)).not.toContain("syndication");
    expect(columnNames(base)).not.toContain("categories");
    expect(columnNames(base)).not.toContain("faq");
  });

  it("flattens a localized group onto the translation table", () => {
    expect(columnNames(translations)).toContain("seoTitle");
    expect(columnNames(translations)).toContain("seoDescription");
    // A localized group moves whole: neither leaf stays behind on the base row.
    expect(columnNames(base)).not.toContain("seoTitle");
    expect(columnNames(base)).not.toContain("seoDescription");
  });

  it("indexes a group leaf declared by its canonical path", () => {
    expect(indexNames(base)).toContain(
      "example_advanced_articles_syndication_priority_idx",
    );
  });

  describe("junction table", () => {
    it("carries exactly the four generated columns", () => {
      expect(columnNames(junction)).toStrictEqual([
        "createdAt",
        "itemId",
        "position",
        "relatedItemId",
      ]);
    });

    it("keys on the pair, so one target cannot be related twice", () => {
      const [primaryKey] = junction.primaryKeys;

      expect(primaryKey.name).toBe("example_advanced_articles_categories_pk");
      expect(primaryKey.columns.map(column => column.name)).toStrictEqual([
        "itemId",
        "relatedItemId",
      ]);
    });

    it("makes duplicate positions impossible", () => {
      const unique = junction.indexes.find(item => item.config.unique);

      expect(unique?.config.name).toBe(
        "example_advanced_articles_categories_position_key",
      );
      expect(
        unique?.config.columns.map(column =>
          "name" in column ? column.name : "",
        ),
      ).toStrictEqual(["itemId", "position"]);
    });

    it("indexes the reverse direction, which ON DELETE RESTRICT reads", () => {
      expect(indexNames(junction)).toContain(
        "example_advanced_articles_categories_related_item_id_idx",
      );
    });

    it("cascades from the source and restricts from the target", () => {
      const fromItem = junction.foreignKeys.find(key =>
        key.reference().columns.some(column => column.name === "itemId"),
      );
      const fromTarget = junction.foreignKeys.find(key =>
        key.reference().columns.some(column => column.name === "relatedItemId"),
      );

      expect(fromItem?.onDelete).toBe("cascade");
      // The field declares `onDelete: "restrict"`, so Postgres refuses to
      // delete a category that is still in use - no service check required.
      expect(fromTarget?.onDelete).toBe("restrict");
    });
  });

  describe("self-relation junction", () => {
    it("points both foreign keys at the same table", () => {
      const targets = selfJunction.foreignKeys.map(key =>
        getTableName(key.reference().foreignTable),
      );

      expect(new Set(targets)).toStrictEqual(
        new Set(["example_advanced_articles"]),
      );
    });

    it("does not collide with the other junction", () => {
      expect(getTableName(example_advanced_articles_related_articles)).not.toBe(
        getTableName(example_advanced_articles_categories),
      );
    });
  });

  describe("repeatable child table", () => {
    it("gives every child a stable identity of its own", () => {
      const id = faq.columns.find(column => column.name === "id");

      expect(id?.primary).toBe(true);
      // Not `(item_id, position)`: position is where a child sits, identity is
      // what an edit addresses and what a restore matches against.
      expect(faq.primaryKeys).toHaveLength(0);
    });

    it("carries the leaf columns with their declared types", () => {
      expect(columnNames(faq)).toStrictEqual([
        "answer",
        "createdAt",
        "id",
        "itemId",
        "position",
        "question",
        "updatedAt",
      ]);

      const question = faq.columns.find(column => column.name === "question");
      const answer = faq.columns.find(column => column.name === "answer");

      expect(question?.getSQLType()).toBe("varchar(200)");
      expect(answer?.getSQLType()).toBe("text");
      expect(question?.notNull).toBe(true);
    });

    it("makes duplicate positions impossible", () => {
      const unique = faq.indexes.find(item => item.config.unique);

      expect(unique?.config.name).toBe(
        "example_advanced_articles_faq_position_key",
      );
    });

    it("goes away with the record it belongs to", () => {
      const [foreignKey] = faq.foreignKeys;

      expect(foreignKey.onDelete).toBe("cascade");
      expect(getTableName(foreignKey.reference().foreignTable)).toBe(
        "example_advanced_articles",
      );
    });
  });
});
