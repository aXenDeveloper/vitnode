import type { Context } from "hono";

import { describe, expectTypeOf, it } from "vitest";

import {
  testEditorialPostContentType,
  testHideableNoteContentType,
  testHideablePostContentType,
} from "@/tests/content-fixtures";

import type { ContentEditorialOutcome } from "./editorial-service";
import type { ContentVisibilityResult } from "./visibility";

import { createContentModel } from "./model";

const hideablePosts = createContentModel(testHideablePostContentType);
const hideableNotes = createContentModel(testHideableNoteContentType);
const editorialPosts = createContentModel(testEditorialPostContentType);

// Never executed - the type checker is the whole point.
const c = {} as Context;

describe("hide and unhide on the services", () => {
  it("exist on the plain repository of a content type with visibility", () => {
    expectTypeOf(hideableNotes.service(c).hide)
      .parameter(0)
      .toEqualTypeOf<number>();
    expectTypeOf(
      hideableNotes.service(c).unhide,
    ).returns.resolves.toEqualTypeOf<ContentVisibilityResult<
      typeof testHideableNoteContentType
    > | null>();
  });

  it("exist on the editorial service, with an optional expectedVersion", () => {
    expectTypeOf(hideablePosts.editorialService).not.toBeUndefined();
    type Editorial = NonNullable<
      ReturnType<NonNullable<typeof hideablePosts.editorialService>>
    >;
    type HideOptions = Parameters<Editorial["hide"]>[1];

    expectTypeOf<HideOptions["expectedVersion"]>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<Parameters<Editorial["hide"]>[0]>().toEqualTypeOf<number>();
    expectTypeOf<
      Awaited<ReturnType<Editorial["hide"]>>
    >().toEqualTypeOf<ContentEditorialOutcome<
      typeof testHideablePostContentType
    > | null>();
  });

  it("are absent without visibility", () => {
    const editorial = editorialPosts.editorialService?.(c, { pluginId: "x" });

    expectTypeOf(editorial?.hide).toEqualTypeOf<undefined>();
    expectTypeOf(editorialPosts.service(c).unhide).toEqualTypeOf<undefined>();
  });

  it("type the visibility columns on a row only when they exist", () => {
    type Row = NonNullable<
      Awaited<ReturnType<ReturnType<typeof hideableNotes.service>["findById"]>>
    >;
    type PlainRow = NonNullable<
      Awaited<ReturnType<ReturnType<typeof editorialPosts.service>["findById"]>>
    >;

    expectTypeOf<Row["hiddenAt"]>().toEqualTypeOf<Date | null>();
    expectTypeOf<Row["hiddenBy"]>().toEqualTypeOf<null | number>();
    expectTypeOf<PlainRow>().not.toHaveProperty("hiddenAt");
    expectTypeOf<
      (typeof hideableNotes.table.$inferSelect)["hiddenAt"]
    >().toEqualTypeOf<Date | null>();
  });

  it("accepts the visibility filter on the admin list only with visibility", () => {
    void hideableNotes.service(c).findMany({
      filters: { status: "published", visibility: "hidden" },
    });
    void editorialPosts.service(c).findMany({
      // @ts-expect-error - no `hiddenAt`, so no visibility filter
      filters: { visibility: "hidden" },
    });
  });
});
