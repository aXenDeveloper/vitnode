// @vitest-environment node
import { assertType, describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testLocalizedArticleContentType,
  testLocalizedGuideContentType,
} from "@/tests/content-fixtures";

import type {
  ContentEventsFor,
  ContentTranslationPublishedPayload,
  ContentTranslationRestoredPayload,
  ContentTranslationUpdatedPayload,
} from "./events";
import type {
  AnyContentTypeDefinition,
  ContentTranslationMeta,
  ContentTranslationRow,
} from "./types";

type Guide = typeof testLocalizedGuideContentType;
type Article = typeof testArticleContentType;
type LocalizedOnly = typeof testLocalizedArticleContentType;

describe("translation lifecycle columns", () => {
  it("gives a localized, published content type a status and a publishedAt", () => {
    expectTypeOf<ContentTranslationRow<Guide>["status"]>().toEqualTypeOf<
      "draft" | "published"
    >();
    expectTypeOf<
      ContentTranslationRow<Guide>["publishedAt"]
    >().toEqualTypeOf<Date | null>();
  });

  it("gives the metadata shape the same pair", () => {
    expectTypeOf<ContentTranslationMeta<Guide>["status"]>().toEqualTypeOf<
      "draft" | "published"
    >();
  });

  it("withholds them from a localized content type without publication", () => {
    // @ts-expect-error - no publication, so a translation has no status to read.
    type _Status = ContentTranslationRow<LocalizedOnly>["status"];
    // @ts-expect-error - same, for the timestamp.
    type _PublishedAt = ContentTranslationRow<LocalizedOnly>["publishedAt"];
  });

  it("still narrows `values` to the localized fields only", () => {
    expectTypeOf<keyof ContentTranslationRow<Guide>["values"]>().toEqualTypeOf<
      "body" | "slug" | "summary" | "title"
    >();
  });
});

describe("translation events", () => {
  type GuideEvents = ContentEventsFor<Guide>;
  type ArticleEvents = ContentEventsFor<Article>;
  type LocalizedOnlyEvents = ContentEventsFor<LocalizedOnly>;

  it("adds the three core translation events for any localized content type", () => {
    expectTypeOf<LocalizedOnlyEvents>().toHaveProperty(
      "content.test.localized.translation_created",
    );
    expectTypeOf<LocalizedOnlyEvents>().toHaveProperty(
      "content.test.localized.translation_updated",
    );
    expectTypeOf<LocalizedOnlyEvents>().toHaveProperty(
      "content.test.localized.translation_deleted",
    );
  });

  it("adds the lifecycle pair only with publication", () => {
    expectTypeOf<GuideEvents>().toHaveProperty(
      "content.test.localized-guide.translation_published",
    );
    type _Missing =
      // @ts-expect-error - no publication, so no translation lifecycle event.
      LocalizedOnlyEvents["content.test.localized.translation_published"];
  });

  it("adds the restore event only with editorial", () => {
    expectTypeOf<GuideEvents>().toHaveProperty(
      "content.test.localized-guide.translation_restored",
    );
    type _Missing =
      // @ts-expect-error - no editorial, so no history to restore from.
      LocalizedOnlyEvents["content.test.localized.translation_restored"];
  });

  it("adds none of them to a non-localized content type", () => {
    type _Missing =
      // @ts-expect-error - a Stage 1 content type gains no translation key.
      ArticleEvents["content.test.article.translation_created"];
  });

  it("narrows changedFields to the localized field names", () => {
    expectTypeOf<
      ContentTranslationUpdatedPayload<Guide>["changedFields"]
    >().toEqualTypeOf<("body" | "slug" | "summary" | "title")[]>();
  });

  it("always carries the locale on every translation payload", () => {
    expectTypeOf<
      ContentTranslationPublishedPayload["locale"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ContentTranslationRestoredPayload<Guide>["restoredFromRevisionId"]
    >().toEqualTypeOf<number>();
  });
});

describe("backward compatibility", () => {
  it("keeps a localized, editorial, published definition assignable to the erased one", () => {
    // Everything that holds a collection of models - the queue handler, the
    // cleanup cron, the registry - is written against this.
    assertType<AnyContentTypeDefinition>(testLocalizedGuideContentType);
    assertType<AnyContentTypeDefinition>(testLocalizedArticleContentType);
    assertType<AnyContentTypeDefinition>(testArticleContentType);
  });

  it("leaves a non-localized row shape with no translation members", () => {
    expectTypeOf<
      keyof ContentTranslationRow<Article>["values"]
    >().toEqualTypeOf<never>();
  });
});
