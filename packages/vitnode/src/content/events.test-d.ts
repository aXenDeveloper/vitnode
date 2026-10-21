import { assertType, describe, expectTypeOf, it } from "vitest";

import { testArticleContentType } from "@/tests/content-fixtures";

import type { VitNodeEvents } from "../api/models/events";
import type { ContentEventsFor } from "./events";

import { contentEventName } from "./events";

type ArticleEvents = ContentEventsFor<typeof testArticleContentType>;

declare module "../api/models/events" {
  // oxlint-disable-next-line typescript/no-empty-object-type -- the members come from the mapped type
  interface VitNodeEvents extends ArticleEvents {}
}

describe("content events", () => {
  it("builds literal event names and keys the map by them", () => {
    expectTypeOf(
      contentEventName(testArticleContentType.id, "created"),
    ).toEqualTypeOf<"content.test.article.created">();
    expectTypeOf<keyof ArticleEvents>().toEqualTypeOf<
      | "content.test.article.created"
      | "content.test.article.deleted"
      | "content.test.article.updated"
    >();
  });

  it("narrows changedFields to the content type's own field names", () => {
    type Updated = ArticleEvents["content.test.article.updated"];

    assertType<Updated>({ changedFields: ["title"], contentId: 1 });
    // @ts-expect-error - "slug" is not a field on this content type
    assertType<Updated>({ changedFields: ["slug"], contentId: 1 });
  });

  it("registers on the global map through module augmentation", () => {
    expectTypeOf<
      VitNodeEvents["content.test.article.created"]
    >().toEqualTypeOf<{ contentId: number }>();
  });
});
