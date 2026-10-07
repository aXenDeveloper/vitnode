import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  AnyContentTypeDefinition,
  ContentCreateInput,
  ContentDetail,
  ContentLocalizedValues,
  ContentPublicSelect,
  ContentSelect,
  ContentSharedValues,
  ContentUpdateInput,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";
import { createContentModel } from "./server/model";

const article = defineContentType({
  id: "test.richtyped",
  tableName: "test_rich_typed",
  localization: { enabled: true, defaultLocale: "en" },
  publication: { enabled: true },
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ localized: true, required: true }),
    intro: field.richText({ nullable: true }),
    footer: field.richText({ defaultValue: "<p>Thanks for reading</p>" }),
    seo: field.group({
      fields: { summary: field.richText({ nullable: true }) },
    }),
    faq: field.repeatable({
      fields: { answer: field.richText({ required: true }) },
    }),
  },
  publicApi: {
    enabled: true,
    path: "rich",
    fields: ["title", "slug", "body", "intro"],
  },
});

type Article = typeof article;

describe("field.richText", () => {
  it("keeps the literal options it was given", () => {
    const descriptor = field.richText({ localized: true, required: true });

    expectTypeOf(descriptor.kind).toEqualTypeOf<"richText">();
    expectTypeOf(descriptor.required).toEqualTypeOf<true>();
    expectTypeOf(descriptor.nullable).toEqualTypeOf<false>();
    expectTypeOf(descriptor.localized).toEqualTypeOf<true>();
  });

  it("is assignable to AnyContentTypeDefinition", () => {
    assertType<AnyContentTypeDefinition>(article);
  });

  it("reads back as an HTML string, nullable only when declared so", () => {
    expectTypeOf<ContentSelect<Article>["intro"]>().toEqualTypeOf<
      null | string
    >();
    expectTypeOf<ContentSelect<Article>["footer"]>().toEqualTypeOf<string>();
    expectTypeOf<
      NonNullable<ContentSelect<Article>["seo"]>["summary"]
    >().toEqualTypeOf<null | string>();
    expectTypeOf<
      ContentDetail<Article>["faq"][number]["answer"]
    >().toEqualTypeOf<string>();
  });

  it("partitions a localized field onto the translation", () => {
    expectTypeOf<ContentLocalizedValues<Article>>().toEqualTypeOf<{
      body: string;
    }>();
    expectTypeOf<ContentSharedValues<Article>>().not.toHaveProperty("body");
  });

  it("makes a defaulted or nullable field optional on create", () => {
    expectTypeOf<ContentCreateInput<Article>>()
      .toHaveProperty("title")
      .toEqualTypeOf<string>();
    expectTypeOf<ContentCreateInput<Article>["footer"]>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<ContentUpdateInput<Article>["intro"]>().toEqualTypeOf<
      null | string | undefined
    >();
  });

  it("exposes the HTML string publicly", () => {
    expectTypeOf<
      ContentPublicSelect<Article>["body"]
    >().toEqualTypeOf<string>();
  });

  it("generates a text column", () => {
    const model = createContentModel(article);

    expectTypeOf(model.table.$inferSelect.intro).toEqualTypeOf<null | string>();
    expectTypeOf(model.table.$inferInsert.footer).toEqualTypeOf<
      string | undefined
    >();
  });
});
