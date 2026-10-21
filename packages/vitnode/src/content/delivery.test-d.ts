import { describe, it } from "vitest";

import { defineContentType } from "./define";
import { field } from "./fields";

const shared = {
  fields: {
    excerpt: field.textarea({ maxLength: 500, nullable: true }),
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
  },
  publication: true,
  publicApi: {
    fields: ["id", "title", "slug", "excerpt", "seo.title", "seo.description"],
    path: "articles",
  },
  id: "typed.delivered",
  tableName: "typed_delivered",
} as const;

describe("delivery", () => {
  it("accepts group leaves and plain fields in the SEO slots", () => {
    defineContentType({
      ...shared,
      editorial: true,
      delivery: {
        redirects: true,
        seo: {
          descriptionField: "seo.description",
          fallbackTitleField: "title",
          openGraph: { descriptionField: "excerpt", titleField: "title" },
          titleField: "seo.title",
        },
        sitemap: { changeFrequency: "weekly", priority: 0.7 },
      },
    });
  });

  it("requires a public API", () => {
    const { publicApi: _publicApi, ...withoutPublicApi } = shared;

    defineContentType({
      ...withoutPublicApi,
      // @ts-expect-error - delivery is about a canonical public URL
      delivery: true,
    });
  });

  it("requires editorial for redirects", () => {
    defineContentType({
      ...shared,
      // @ts-expect-error - slug history is written in the editorial transaction
      delivery: { redirects: true },
    });
  });

  it("refuses SEO fields that are private, prose or undeclared", () => {
    defineContentType({
      ...shared,
      // @ts-expect-error - `internalCode` is not in `publicApi.fields`
      delivery: { seo: { titleField: "internalCode" } },
    });
    defineContentType({
      ...shared,
      // @ts-expect-error - `excerpt` is a textarea, a `<title>` is one line
      delivery: { seo: { titleField: "excerpt" } },
    });
    defineContentType({
      ...shared,
      // @ts-expect-error - `seo.heading` is not a leaf of the `seo` group
      delivery: { seo: { titleField: "seo.heading" } },
    });
  });

  it("refuses an unknown change frequency", () => {
    defineContentType({
      ...shared,
      // @ts-expect-error - not one of the seven sitemap values
      delivery: { sitemap: { changeFrequency: "fortnightly" } },
    });
  });
});
