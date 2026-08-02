import { assertType, describe, expectTypeOf, it } from "vitest";

import { testArticleContentType } from "@/tests/content-fixtures";

import type { VitNodeEvents } from "../api/models/events";
import type { ContentEventsFor } from "./events";

import { contentEventName } from "./events";

type ArticleEvents = ContentEventsFor<typeof testArticleContentType>;

// The pattern plugins use. It compiles only if the mapped keys are statically
// known, which is exactly what makes the whole approach viable.
declare module "../api/models/events" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the members come from the mapped type
  interface VitNodeEvents extends ContentEventsFor<
    typeof testArticleContentType
  > {}
}

describe("content events", () => {
  it("builds literal event names", () => {
    expectTypeOf(
      contentEventName(testArticleContentType.id, "created"),
    ).toEqualTypeOf<"content.test.article.created">();
    expectTypeOf(
      contentEventName(testArticleContentType.id, "deleted"),
    ).toEqualTypeOf<"content.test.article.deleted">();
  });

  it("keys the event map by literal name", () => {
    expectTypeOf<keyof ArticleEvents>().toEqualTypeOf<
      | "content.test.article.created"
      | "content.test.article.deleted"
      | "content.test.article.updated"
    >();
  });

  it("carries only the content identifier on create and delete", () => {
    expectTypeOf<
      ArticleEvents["content.test.article.created"]
    >().toEqualTypeOf<{ contentId: number }>();
    expectTypeOf<
      ArticleEvents["content.test.article.deleted"]
    >().toEqualTypeOf<{ contentId: number }>();
  });

  it("narrows changedFields to the content type's own field names", () => {
    type Updated = ArticleEvents["content.test.article.updated"];

    expectTypeOf<Updated["changedFields"]>().toEqualTypeOf<
      (
        | "author"
        | "category"
        | "excerpt"
        | "featured"
        | "publishedAt"
        | "status"
        | "title"
        | "views"
      )[]
    >();

    assertType<Updated>({ changedFields: ["title"], contentId: 1 });
    // @ts-expect-error - "slug" is not a field on this content type
    assertType<Updated>({ changedFields: ["slug"], contentId: 1 });
  });

  it("registers the events on the global map", () => {
    expectTypeOf<
      VitNodeEvents["content.test.article.created"]
    >().toEqualTypeOf<{ contentId: number }>();
  });
});
