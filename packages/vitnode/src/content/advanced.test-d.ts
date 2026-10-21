import { assertType, describe, expectTypeOf, it } from "vitest";

import type { ContentModel } from "./server";
import type {
  ContentCreateInput,
  ContentFilterInput,
  ContentIndexInput,
  ContentPublicSelect,
  ContentSelect,
  ContentUpdateInput,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

const categoryContentType = defineContentType({
  fields: { name: field.text({ required: true }) },
  id: "test.d-category",
  tableName: "test_d_categories",
});

const articleContentType = defineContentType({
  admin: {
    list: { columns: ["title"] },
    titleField: "title",
  },
  editorial: true,
  fields: {
    categories: field.relation({
      multiple: true,
      target: () => categoryContentType,
    }),
    faq: field.repeatable({
      fields: {
        answer: field.textarea({ required: true }),
        question: field.text({ required: true }),
      },
    }),
    related: field.relation({ multiple: true, ordered: true, self: true }),
    seo: field.group({
      fields: {
        description: field.textarea({ nullable: true }),
        title: field.text({ nullable: true }),
      },
      nullable: true,
    }),
    slug: field.slug({ source: "title" }),
    title: field.text({ required: true }),
  },
  id: "test.d-article",
  publicApi: {
    fields: ["title", "slug", "categories", "seo.title", "faq.question"],
    path: "d-articles",
  },
  publication: true,
  tableName: "test_d_articles",
});

type Article = typeof articleContentType;

declare const service: ReturnType<ContentModel<Article>["service"]>;
declare const editorial: ReturnType<
  NonNullable<ContentModel<Article>["editorialService"]>
>;

describe("groups and collections", () => {
  it("keeps a group nested and collections off the row", () => {
    assertType<ContentSelect<Article>["seo"]>({ description: null, title: "" });
    expectTypeOf<ContentSelect<Article>>().not.toHaveProperty("seoTitle");
    expectTypeOf<ContentSelect<Article>>().not.toHaveProperty("categories");
    expectTypeOf<ContentSelect<Article>>().not.toHaveProperty("faq");
  });

  it("takes nested groups and whole collections on write", () => {
    assertType<ContentCreateInput<Article>>({
      categories: [1, 2],
      faq: [{ answer: "A", question: "Q" }],
      seo: { title: "SEO" },
      title: "Hello",
    });
    assertType<ContentUpdateInput<Article>>({ seo: { description: "Only" } });
    // @ts-expect-error `seo` has `title` and `description`, not `keywords`.
    assertType<ContentUpdateInput<Article>>({ seo: { keywords: "no" } });
    // @ts-expect-error the logical shape is nested; `seoTitle` is not a field.
    assertType<ContentUpdateInput<Article>>({ seoTitle: "no" });
    // @ts-expect-error a collection is replaced whole, with identifiers.
    assertType<ContentUpdateInput<Article>>({ categories: [{ id: 3 }] });
  });

  it("filters a to-many relation by membership only", () => {
    assertType<ContentFilterInput<Article>>({ categories: { contains: 7 } });
    // @ts-expect-error a to-many relation is not an equality filter.
    assertType<ContentFilterInput<Article>>({ categories: 7 });
  });

  it("projects only the allowlisted leaves publicly", () => {
    assertType<ContentPublicSelect<Article>["seo"]>({
      // @ts-expect-error a private leaf is not part of the public shape.
      description: "leak",
      title: "SEO",
    });
    assertType<ContentPublicSelect<Article>["faq"]>([
      // @ts-expect-error `faq.answer` is not in `publicApi.fields`.
      { answer: "leak", id: 11, question: "Q" },
    ]);
    expectTypeOf<ContentPublicSelect<Article>>().not.toHaveProperty("related");
  });

  it("indexes only single columns", () => {
    type Index = ContentIndexInput<Article["fields"], true, true>;

    assertType<Index>({ on: ["seo.title"] });
    // @ts-expect-error a repeatable leaf is a column on a child table.
    assertType<Index>({ on: ["faq.question"] });
    // @ts-expect-error a to-many relation has no column to index.
    assertType<Index>({ on: ["categories"] });
    // @ts-expect-error a group is several columns rather than one.
    assertType<Index>({ on: ["seo"] });
  });
});

describe("admin surfaces", () => {
  it("refuse a gallery as the list thumbnail", () => {
    defineContentType({
      admin: {
        list: {
          columns: ["name"],
          // @ts-expect-error a gallery is many images, not one thumbnail.
          thumbnailField: "photos",
        },
        titleField: "name",
      },
      fields: {
        name: field.text({ required: true }),
        photos: field.file({ maxBytes: 1024, multiple: true }),
      },
      id: "test.d-thumbs",
      tableName: "test_d_thumbs",
    });
  });

  it("refuse a repeatable as a list column", () => {
    defineContentType({
      admin: {
        // @ts-expect-error a repeatable is many rows of values, not one cell.
        list: { columns: ["faq"] },
      },
      fields: {
        faq: field.repeatable({
          fields: { question: field.text({ required: true }) },
        }),
        name: field.text({ required: true }),
      },
      id: "test.d-badlist",
      tableName: "test_d_badlist",
    });
  });
});

describe("the typed collection API", () => {
  it("keys relations and repeatables by their declared names", () => {
    expectTypeOf<(typeof service)["relations"]>().toHaveProperty("categories");
    expectTypeOf<(typeof service)["relations"]>().not.toHaveProperty("faq");
    expectTypeOf<(typeof service)["repeatable"]>().toHaveProperty("faq");
    expectTypeOf<(typeof service)["repeatable"]>().not.toHaveProperty(
      "categories",
    );
  });

  it("infers a repeatable's values from its own leaves", () => {
    void service.repeatable.faq.create(7, { answer: "A", question: "Q" });
    // @ts-expect-error `answer` is required.
    void service.repeatable.faq.create(7, { question: "Q" });
    // @ts-expect-error partial does not mean permissive.
    void service.repeatable.faq.update(7, 11, { unknownField: "no" });
  });

  it("requires an actor and a version on the editorial helpers only", () => {
    void editorial.relations.categories.add(7, 1, {
      actor: { type: "staff", userId: 1 },
      expectedVersion: 3,
    });
    // @ts-expect-error the editorial API never writes without a version guard.
    void editorial.relations.categories.add(7, 1, {});
    // @ts-expect-error use `editorialService.relations` for optimistic locking.
    void service.relations.categories.add(7, 1, { expectedVersion: 3 });
  });
});
