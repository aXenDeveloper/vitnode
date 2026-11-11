import { assertType, describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import type { EventInput, EventPayload } from "../api/lib/event-definition";
import type { ContentEventActionOf } from "./event-definitions";
import type { ContentEventsFor } from "./events";

import { contentEvent } from "./event-definitions";

type ArticleEvents = ContentEventsFor<typeof testArticleContentType>;

describe("content events", () => {
  it("builds literal event names and keys the map by them", () => {
    expectTypeOf(
      contentEvent(testArticleContentType, "created").name,
    ).toEqualTypeOf<"content.test.article.created">();
    expectTypeOf<keyof ArticleEvents>().toEqualTypeOf<
      | "content.test.article.created"
      | "content.test.article.deleted"
      | "content.test.article.updated"
    >();
    expectTypeOf<
      ContentEventActionOf<typeof testArticleContentType>
    >().toEqualTypeOf<"created" | "deleted" | "updated">();
  });

  it("narrows changedFields to the content type's own field names", () => {
    type Updated = ArticleEvents["content.test.article.updated"];

    assertType<Updated>({ changedFields: ["title"], contentId: 1 });
    // @ts-expect-error - "slug" is not a field on this content type
    assertType<Updated>({ changedFields: ["slug"], contentId: 1 });
  });

  it("types the definition's payload from the content type", () => {
    expectTypeOf<
      EventPayload<ReturnType<typeof createdEvent>>
    >().toEqualTypeOf<{ contentId: number }>();
  });

  it("only accepts the actions the content type enables", () => {
    contentEvent(testPostContentType, "published");
    // @ts-expect-error - test.article does not enable publication
    contentEvent(testArticleContentType, "published");
    // @ts-expect-error - not a content action at all
    contentEvent(testArticleContentType, "archived");
  });

  it("takes ISO strings on the wire and hands listeners Dates", () => {
    const published = contentEvent(testPostContentType, "published");

    expectTypeOf<
      EventInput<typeof published>["publishedAt"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      EventPayload<typeof published>["publishedAt"]
    >().toEqualTypeOf<Date>();
  });
});

const createdEvent = () => contentEvent(testArticleContentType, "created");
