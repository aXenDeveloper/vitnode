import { assertType, describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import type { ContentEventsFor } from "./events";
import type {
  AnyContentTypeDefinition,
  ContentSitemapChangeFrequency,
  DeliverableContentTypeDefinition,
  ResolvedContentDeliveryConfig,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

const fields = {
  excerpt: field.textarea({ maxLength: 500, nullable: true }),
  /** Declared but never exposed - the private half of every check below. */
  internalCode: field.text({ nullable: true }),
  seo: field.group({
    fields: {
      description: field.textarea({ nullable: true }),
      title: field.text({ nullable: true }),
    },
    nullable: true,
  }),
  slug: field.slug({ source: "title" }),
  title: field.text({ maxLength: 200, required: true }),
  views: field.number({ integer: true, defaultValue: 0 }),
};

const shared = {
  fields,
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    fields: ["id", "title", "slug", "excerpt", "seo.title", "seo.description"],
    path: "articles",
  },
} as const;

const deliveredType = defineContentType({
  ...shared,
  id: "typed.delivered",
  editorial: { enabled: true },
  delivery: {
    enabled: true,
    redirects: { enabled: true },
    seo: {
      descriptionField: "seo.description",
      fallbackDescriptionField: "excerpt",
      fallbackTitleField: "title",
      openGraph: { descriptionField: "excerpt", titleField: "title" },
      titleField: "seo.title",
    },
    sitemap: { changeFrequency: "weekly", enabled: true, priority: 0.7 },
  },
  tableName: "typed_delivered",
});

const plainType = defineContentType({
  ...shared,
  id: "typed.plain",
  tableName: "typed_plain",
});

describe("delivery configuration", () => {
  it("keeps the `enabled` literal, so every conditional resolves", () => {
    expectTypeOf(deliveredType.delivery.enabled).toEqualTypeOf<true>();
    expectTypeOf(plainType.delivery.enabled).toEqualTypeOf<false>();
  });

  // The whole Stage 8 type design rests on this: an eleventh type parameter on
  // `ContentTypeDefinition` must not break the erased form every relation thunk,
  // registry and route builder is written against.
  it("stays assignable to AnyContentTypeDefinition", () => {
    expectTypeOf<typeof deliveredType>().toExtend<AnyContentTypeDefinition>();
    assertType<AnyContentTypeDefinition>(deliveredType);
    assertType<AnyContentTypeDefinition>(plainType);
  });

  it("narrows to DeliverableContentTypeDefinition only with delivery", () => {
    expectTypeOf<
      typeof deliveredType
    >().toExtend<DeliverableContentTypeDefinition>();
    expectTypeOf<
      typeof plainType
    >().not.toExtend<DeliverableContentTypeDefinition>();
  });

  it("accepts a group leaf and a plain field in the SEO slots", () => {
    expectTypeOf(deliveredType.delivery.seo.titleField).toEqualTypeOf<
      null | string
    >();
    expectTypeOf(
      deliveredType.delivery.sitemap.changeFrequency,
    ).toEqualTypeOf<ContentSitemapChangeFrequency | null>();
  });

  it("records the slug scope", () => {
    expectTypeOf(deliveredType.delivery.slugScope).toEqualTypeOf<
      "localized" | "none" | "shared"
    >();
  });
});

describe("delivery requires a public API", () => {
  it("refuses `enabled: true` without one", () => {
    defineContentType({
      id: "typed.no-public",
      // @ts-expect-error - delivery needs `publicApi: { enabled: true }`: without a
      // public allowlist there is no canonical URL for delivery to be about.
      delivery: { enabled: true },
      fields,
      publication: { enabled: true },
      tableName: "typed_no_public",
    });
  });

  it("still accepts an explicit `enabled: false`", () => {
    const off = defineContentType({
      id: "typed.off",
      delivery: { enabled: false },
      fields,
      publication: { enabled: true },
      tableName: "typed_off",
    });

    expectTypeOf(off.delivery.enabled).toEqualTypeOf<false>();
  });
});

describe("redirects require editorial", () => {
  it("refuses `redirects: { enabled: true }` without editorial", () => {
    defineContentType({
      ...shared,
      id: "typed.no-editorial",
      delivery: {
        enabled: true,
        // @ts-expect-error - slug history has to be written in the same transaction
        // as the slug mutation and its revision, and only the editorial mutation
        // paths own one. Without `editorial` this would record nothing.
        redirects: { enabled: true },
      },
      tableName: "typed_no_editorial",
    });
  });

  it("still accepts an explicit `redirects: { enabled: false }`", () => {
    const off = defineContentType({
      ...shared,
      id: "typed.redirects-off",
      delivery: { enabled: true, redirects: { enabled: false } },
      tableName: "typed_redirects_off",
    });

    expectTypeOf(off.delivery.enabled).toEqualTypeOf<true>();
  });

  it("accepts redirects once editorial is enabled", () => {
    const on = defineContentType({
      ...shared,
      id: "typed.redirects-on",
      editorial: { enabled: true },
      delivery: { enabled: true, redirects: { enabled: true } },
      tableName: "typed_redirects_on",
    });

    expectTypeOf(on.delivery.enabled).toEqualTypeOf<true>();
  });

  it("leaves every other delivery block available without editorial", () => {
    // The rule is narrow on purpose: only slug history needs a transaction.
    const reads = defineContentType({
      ...shared,
      id: "typed.reads-only",
      delivery: {
        enabled: true,
        seo: { descriptionField: "excerpt", titleField: "title" },
        sitemap: { changeFrequency: "daily", enabled: true, priority: 0.5 },
      },
      tableName: "typed_reads_only",
    });

    expectTypeOf(reads.delivery.enabled).toEqualTypeOf<true>();
    expectTypeOf(reads.editorial.enabled).toEqualTypeOf<false>();
  });
});

describe("SEO field references", () => {
  it("refuses a field the public allowlist withholds", () => {
    defineContentType({
      ...shared,
      id: "typed.private-seo",
      delivery: {
        enabled: true,
        // @ts-expect-error - `internalCode` is a text field, but it is not in
        // `publicApi.fields`, and a `<title>` is rendered into a public page.
        seo: { titleField: "internalCode" },
      },
      tableName: "typed_private_seo",
    });
  });

  it("refuses prose in a title slot", () => {
    defineContentType({
      ...shared,
      id: "typed.prose-title",
      delivery: {
        enabled: true,
        // @ts-expect-error - `excerpt` is a textarea. A `<title>` is one line, and a
        // paragraph in a browser tab is not a heading.
        seo: { titleField: "excerpt" },
      },
      tableName: "typed_prose_title",
    });
  });

  it("refuses a number in a description slot", () => {
    defineContentType({
      ...shared,
      id: "typed-bad.description",
      delivery: {
        enabled: true,
        // @ts-expect-error - `views` is a number, and it is private besides.
        seo: { descriptionField: "views" },
      },
      tableName: "typed_bad_description",
    });
  });

  it("refuses a nested path the content type does not declare", () => {
    defineContentType({
      ...shared,
      id: "typed.bad-path",
      delivery: {
        enabled: true,
        // @ts-expect-error - `seo.heading` is not a leaf of the `seo` group.
        seo: { titleField: "seo.heading" },
      },
      tableName: "typed_bad_path",
    });
  });

  it("accepts a valid nested group path", () => {
    const nested = defineContentType({
      ...shared,
      id: "typed.nested",
      delivery: {
        enabled: true,
        seo: { descriptionField: "seo.description", titleField: "seo.title" },
      },
      tableName: "typed_nested",
    });

    expectTypeOf(nested.delivery.enabled).toEqualTypeOf<true>();
  });

  it("refuses an unknown change frequency", () => {
    defineContentType({
      ...shared,
      id: "typed.bad-freq",
      delivery: {
        enabled: true,
        // @ts-expect-error - not one of the seven values the protocol defines.
        sitemap: { changeFrequency: "fortnightly", enabled: true },
      },
      tableName: "typed_bad_freq",
    });
  });
});

describe("the resolved config is generic over `enabled`", () => {
  it("pins `true` for a delivered content type", () => {
    expectTypeOf(deliveredType.delivery).toExtend<
      ResolvedContentDeliveryConfig<true>
    >();
  });

  it("pins `false` for one without", () => {
    expectTypeOf(plainType.delivery).toExtend<
      ResolvedContentDeliveryConfig<false>
    >();
  });
});

describe("Stage 1-7 backward compatibility", () => {
  it("leaves the existing fixtures assignable and unchanged", () => {
    assertType<AnyContentTypeDefinition>(testArticleContentType);
    assertType<AnyContentTypeDefinition>(testPostContentType);
    expectTypeOf(
      testArticleContentType.delivery.enabled,
    ).toEqualTypeOf<false>();
    expectTypeOf(testPostContentType.delivery.enabled).toEqualTypeOf<false>();
  });
});

describe("delivery events", () => {
  it("adds both keys for a content type with redirects", () => {
    expectTypeOf<ContentEventsFor<typeof deliveredType>>().toHaveProperty(
      "content.typed.delivered.delivery_slug_changed",
    );
    expectTypeOf<ContentEventsFor<typeof deliveredType>>().toHaveProperty(
      "content.typed.delivered.delivery_redirect_created",
    );
  });

  it("adds neither for a content type without delivery", () => {
    // The keys are gated on `delivery: { enabled: true }`, so a listener for one
    // cannot even be registered - which is what keeps every Stage 1-7 event map
    // byte-identical.
    expectTypeOf<ContentEventsFor<typeof plainType>>().not.toHaveProperty(
      "content.typed.plain.delivery_slug_changed",
    );
    expectTypeOf<ContentEventsFor<typeof plainType>>().not.toHaveProperty(
      "content.typed.plain.delivery_redirect_created",
    );
  });

  it("keeps the ordinary events in place alongside them", () => {
    expectTypeOf<ContentEventsFor<typeof deliveredType>>().toHaveProperty(
      "content.typed.delivered.updated",
    );
    expectTypeOf<ContentEventsFor<typeof deliveredType>>().toHaveProperty(
      "content.typed.delivered.published",
    );
  });
});
