import type { Context } from "hono";

import { describe, expectTypeOf, it } from "vitest";

import {
  testCategoryContentType,
  testDuplicableArticleContentType,
  testDuplicableNoteContentType,
} from "@/tests/content-fixtures";

import type { ContentEventsFor } from "../events";
import type {
  ContentDuplicateResult,
  ContentEditorialDuplicateOutcome,
} from "./duplicate";

import { createContentModel } from "./model";

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testDuplicableArticleContentType, {
  references: { categories: () => categories.table.id },
});
const notes = createContentModel(testDuplicableNoteContentType);

declare const c: Context;

type Note = typeof testDuplicableNoteContentType;
type Article = typeof testDuplicableArticleContentType;

describe("duplicate", () => {
  it("exists only on a content type that enables duplication", () => {
    expectTypeOf(notes.service(c).duplicate).toBeFunction();
    expectTypeOf(categories.service(c).duplicate).toEqualTypeOf<undefined>();
  });

  it("takes and returns the content type's own identifier", () => {
    expectTypeOf(notes.service(c).duplicate)
      .parameter(0)
      .toEqualTypeOf<number>();
    expectTypeOf(
      notes.service(c).duplicate,
    ).returns.resolves.toEqualTypeOf<ContentDuplicateResult<Note> | null>();
  });

  it("is the editorial outcome on the editorial service, actor required", () => {
    const editorial = articles.editorialService?.(c, { pluginId: "x" });
    if (!editorial) return;

    expectTypeOf(
      editorial.duplicate,
    ).returns.resolves.toEqualTypeOf<ContentEditorialDuplicateOutcome<Article> | null>();
    expectTypeOf(editorial.duplicate).parameter(1).toHaveProperty("actor");
  });

  it("types overrides from the content type's own fields", () => {
    // @ts-expect-error - `nope` is not a field of the note content type
    void notes.service(c).duplicate(1, { overrides: { nope: true } });
  });

  it("announces the copy with a typed `duplicated` event", () => {
    expectTypeOf<
      ContentEventsFor<Note>["content.test.duplicable-note.duplicated"]
    >().toEqualTypeOf<{
      actorUserId: null | number;
      contentId: number;
      contentTypeId: string;
      sourceId: number;
    }>();
  });
});
