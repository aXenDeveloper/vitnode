import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { AnyContentTypeDefinition } from "../types";

import { defineContentType } from "../define";
import { ContentEngineError } from "../errors";
import { field } from "../fields";
import { assertContentReferences, createContentTable } from "./table";

const categories = createContentTable(testCategoryContentType);
const articles = createContentTable(testArticleContentType, {
  references: { category: () => categories.id },
});

describe("createContentTable", () => {
  it("explains a missing definition instead of throwing a TypeError", () => {
    expect(() =>
      createContentTable(undefined as unknown as AnyContentTypeDefinition),
    ).toThrow(/no definition.*build:plugins.*circular import/s);
  });

  describe("foreign keys", () => {
    it("keeps two content types that reference each other safe", () => {
      // Annotated, not inferred: two definitions that name each other are a
      // circular inference, and this is the shape a plugin would import anyway.
      const shelfType: AnyContentTypeDefinition = defineContentType({
        id: "test.shelf",
        tableName: "test_shelves",
        fields: {
          title: field.text({ required: true }),
          featured: field.relation({
            nullable: true,
            target: () => bookType,
          }),
        },
      });
      const bookType: AnyContentTypeDefinition = defineContentType({
        id: "test.book",
        tableName: "test_books",
        fields: {
          title: field.text({ required: true }),
          shelf: field.relation({ required: true, target: () => shelfType }),
        },
      });

      const shelves = createContentTable(shelfType, {
        references: { featured: () => books.id },
      });
      const books = createContentTable(bookType, {
        references: { shelf: () => shelves.id },
      });

      expect(() => assertContentReferences(shelves)).not.toThrow();
      expect(() => assertContentReferences(books)).not.toThrow();
    });

    it("explains a reference thunk that resolved to nothing", () => {
      // What a half-written `dist` looks like from in here: the target module
      // has not finished emitting, so the import binding is still empty.
      const unbuilt = createContentTable(testArticleContentType, {
        references: { category: () => undefined as never },
      });

      expect(() => assertContentReferences(unbuilt)).toThrow(
        /resolved to nothing.*build:plugins/s,
      );
    });

    it("rejects a relation with no reference thunk", () => {
      expect(() => createContentTable(testArticleContentType)).toThrow(
        ContentEngineError,
      );
    });

    it("accepts a reference that matches the descriptor's target", () => {
      expect(() => assertContentReferences(articles)).not.toThrow();
    });

    it("rejects a reference pointing at a different table", () => {
      const decoys = createContentTable(
        defineContentType({
          id: "test.decoy",
          tableName: "test_decoys",
          fields: { title: field.text({ required: true }) },
        }),
      );

      // `field.relation({ target })` says `test_categories`; `references` says
      // `test_decoys`. Nothing but this check stops the two drifting apart.
      const drifted = createContentTable(testArticleContentType, {
        references: { category: () => decoys.id },
      });

      expect(() => assertContentReferences(drifted)).toThrow(
        /targets "test_categories".*points at "test_decoys"/s,
      );
    });

    it("does not resolve any target while the table is being built", () => {
      const exploding = defineContentType({
        id: "test.lazy",
        tableName: "test_lazies",
        fields: {
          other: field.relation({
            required: true,
            target: () => {
              throw new Error("evaluated too early");
            },
          }),
        },
      });

      expect(() =>
        createContentTable(exploding, {
          references: { other: () => categories.id },
        }),
      ).not.toThrow();
    });

    describe("across id strategies", () => {
      // The same table name with a `uuid` key, so only the key type can differ.
      const uuidCategory = defineContentType({
        fields: { title: field.text({ required: true }) },
        id: "test.uuid-category",
        idStrategy: "uuid",
        tableName: "test_categories",
      });
      const pointing = (
        target: () => AnyContentTypeDefinition,
      ): AnyContentTypeDefinition =>
        defineContentType({
          fields: { category: field.relation({ required: true, target }) },
          id: "test.pointing",
          tableName: "test_pointing",
        });

      it("builds the foreign key with the type of the key it points at", () => {
        const uuidCategories = createContentTable(uuidCategory);
        const table = createContentTable(
          pointing(() => uuidCategory) as typeof testArticleContentType,
          { references: { category: () => uuidCategories.id } },
        );

        expect(
          getTableConfig(table)
            .columns.find(item => item.name === "category")
            ?.getSQLType(),
        ).toBe("uuid");
        expect(() => assertContentReferences(table)).not.toThrow();
      });

      it("names the field when the referenced key has another type", () => {
        // The descriptor says the target is keyed by `uuid`, while the table
        // handed to `references` is the serial one: a column built as `uuid`
        // would point at an `integer`.
        const table = createContentTable(
          pointing(() => uuidCategory) as typeof testArticleContentType,
          { references: { category: () => categories.id } },
        );

        expect(() => assertContentReferences(table)).toThrow(
          /"category".*idStrategy: "uuid".*`serial`/s,
        );
      });

      it("falls back to serial for a target it cannot read yet, and says so when that was wrong", () => {
        const uuidCategories = createContentTable(uuidCategory);
        let loaded = false;
        const table = createContentTable(
          pointing(() => {
            if (!loaded) throw new Error("still loading");

            return uuidCategory;
          }) as typeof testArticleContentType,
          { references: { category: () => uuidCategories.id } },
        );
        loaded = true;

        expect(() => assertContentReferences(table)).toThrow(
          /"category".*idStrategy: "serial".*`uuid`/s,
        );
      });
    });

    it("rejects a reference for a field that is not a relation", () => {
      // A content type with no relations has an empty `references` type, which
      // does not trip excess-property checking, so the runtime guard is the
      // one that catches this.
      expect(() =>
        createContentTable(testCategoryContentType, {
          references: { title: () => categories.id },
        }),
      ).toThrow(/not a relation field/);
    });
  });
});
