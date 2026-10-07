import { describe, expectTypeOf, it } from "vitest";

import type { testArticleContentType } from "@/tests/content-fixtures";

import {
  testBigintEventContentType,
  testBigintPageContentType,
  testCategoryContentType,
  testUuidTagContentType,
} from "@/tests/content-fixtures";

import type { ContentEventsFor } from "./events";
import type { ContentIdOf } from "./ids";
import type { ContentService } from "./server/service";
import type {
  ContentCreateInput,
  ContentDetail,
  ContentFilterInput,
  ContentPublicRelation,
  ContentPublicSelect,
  ContentRelationTarget,
  ContentSelect,
  ContentTranslationRow,
} from "./types";

import { createContentTable } from "./server/table";
import { createContentTranslationTable } from "./server/translation-table";

type Tag = typeof testUuidTagContentType;
type Event = typeof testBigintEventContentType;
type Page = typeof testBigintPageContentType;

describe("ContentIdOf", () => {
  it("is a number for serial and a string for uuid and bigint", () => {
    expectTypeOf<
      ContentIdOf<typeof testCategoryContentType>
    >().toEqualTypeOf<number>();
    expectTypeOf<ContentIdOf<Tag>>().toEqualTypeOf<string>();
    expectTypeOf<ContentIdOf<Event>>().toEqualTypeOf<string>();
  });
});

describe("rows", () => {
  it("types `id` by the content type's own strategy", () => {
    expectTypeOf<ContentSelect<Tag>["id"]>().toEqualTypeOf<string>();
    expectTypeOf<ContentSelect<Event>["id"]>().toEqualTypeOf<string>();
    expectTypeOf<
      ContentSelect<typeof testArticleContentType>["id"]
    >().toEqualTypeOf<number>();
  });

  it("types a to-one relation by its target's strategy", () => {
    expectTypeOf<ContentSelect<Event>["primaryTag"]>().toEqualTypeOf<
      null | string
    >();
    expectTypeOf<ContentSelect<Event>["category"]>().toEqualTypeOf<
      null | number
    >();
    expectTypeOf<ContentSelect<Tag>["category"]>().toEqualTypeOf<
      null | number
    >();
  });

  it("types a to-many relation by its target's strategy", () => {
    expectTypeOf<ContentDetail<Event>["tags"]>().toEqualTypeOf<string[]>();
    expectTypeOf<ContentCreateInput<Event>["tags"]>().toEqualTypeOf<
      string[] | undefined
    >();
  });

  it("re-points a self-relation at the owner's strategy", () => {
    expectTypeOf<ContentDetail<Event>["relatedEvents"]>().toEqualTypeOf<
      string[]
    >();
    expectTypeOf<ContentDetail<Tag>["relatedTags"]>().toEqualTypeOf<string[]>();
  });

  it("keeps a repeatable child's own id a number", () => {
    expectTypeOf<
      ContentDetail<Event>["sessions"][number]["id"]
    >().toEqualTypeOf<number>();
  });

  it("types a translation's itemId by the owner's strategy", () => {
    expectTypeOf<
      ContentTranslationRow<Page>["itemId"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ContentTranslationRow<Tag>["itemId"]
    >().toEqualTypeOf<string>();
  });

  it("types a membership filter by the target's strategy", () => {
    expectTypeOf<ContentFilterInput<Event>["tags"]>().toEqualTypeOf<
      undefined | { contains: string }
    >();
  });
});

describe("the public projection", () => {
  it("carries string ids for uuid and bigint", () => {
    expectTypeOf<ContentPublicSelect<Event>["id"]>().toEqualTypeOf<string>();
    expectTypeOf<
      ContentPublicSelect<Event>["primaryTag"]
    >().toEqualTypeOf<ContentPublicRelation<string> | null>();
    expectTypeOf<
      ContentPublicSelect<Event>["category"]
    >().toEqualTypeOf<ContentPublicRelation | null>();
    expectTypeOf<ContentPublicSelect<Event>["tags"]>().toEqualTypeOf<
      string[]
    >();
  });
});

describe("services", () => {
  it("take the content type's own id", () => {
    expectTypeOf<
      Parameters<ContentService<Event>["findById"]>[0]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      Parameters<ContentService<typeof testArticleContentType>["findById"]>[0]
    >().toEqualTypeOf<number>();
  });

  it("type a collection's targets by their own strategy", () => {
    type Tags = ContentService<Event>["relations"]["tags"];

    expectTypeOf<Parameters<Tags["add"]>[0]>().toEqualTypeOf<string>();
    expectTypeOf<Parameters<Tags["add"]>[1]>().toEqualTypeOf<string>();
    expectTypeOf<Awaited<ReturnType<Tags["get"]>>>().toEqualTypeOf<string[]>();
  });
});

describe("events", () => {
  it("carry the content type's own id", () => {
    type Events = ContentEventsFor<Event>;

    expectTypeOf<
      Events["content.test.bigint-event.created"]["contentId"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      Events["content.test.bigint-event.hidden"]["contentId"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ContentEventsFor<
        typeof testArticleContentType
      >["content.test.article.created"]["contentId"]
    >().toEqualTypeOf<number>();
  });
});

describe("generated tables", () => {
  const categories = createContentTable(testCategoryContentType);
  const tags = createContentTable(testUuidTagContentType, {
    references: { category: () => categories.id },
  });
  const _events = createContentTable(testBigintEventContentType, {
    references: {
      category: () => categories.id,
      primaryTag: () => tags.id,
      tags: () => tags.id,
    },
  });
  const pages = createContentTable(testBigintPageContentType);
  const _pageTranslations = createContentTranslationTable(
    testBigintPageContentType,
    { table: pages },
  );

  it("infer their select rows from the same strategies", () => {
    expectTypeOf<(typeof tags)["$inferSelect"]["id"]>().toEqualTypeOf<string>();
    expectTypeOf<
      (typeof _events)["$inferSelect"]["id"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      (typeof _events)["$inferSelect"]["primaryTag"]
    >().toEqualTypeOf<null | string>();
    expectTypeOf<(typeof _events)["$inferSelect"]["category"]>().toEqualTypeOf<
      null | number
    >();
    expectTypeOf<
      (typeof _pageTranslations)["$inferSelect"]["itemId"]
    >().toEqualTypeOf<string>();
  });

  it("generate the id, so an insert may leave it out", () => {
    expectTypeOf<
      undefined extends (typeof tags)["$inferInsert"]["id"] ? true : false
    >().toEqualTypeOf<true>();
    expectTypeOf<
      undefined extends (typeof _events)["$inferInsert"]["id"] ? true : false
    >().toEqualTypeOf<true>();
  });
});

describe("relation targets", () => {
  it("infer serial for every relation written before strategies existed", () => {
    type Category = (typeof testArticleContentType)["fields"]["category"];

    expectTypeOf<ReturnType<Category["target"]>>().toEqualTypeOf<
      ContentRelationTarget<"serial">
    >();
  });
});
