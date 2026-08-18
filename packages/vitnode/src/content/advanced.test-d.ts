import { assertType, describe, expectTypeOf, it } from "vitest";

import type { AnyContentModel, ContentModel } from "./server";
import type {
  AnyContentTypeDefinition,
  ContentAdvancedValues,
  ContentChangedPath,
  ContentCreateInput,
  ContentDetail,
  ContentFilterInput,
  ContentIndexInput,
  ContentPublicExposableField,
  ContentPublicSelect,
  ContentSelect,
  ContentUpdateInput,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

/**
 * The type-level contract of Stage 6.
 *
 * The interesting assertions are the negative ones. A group that leaked its
 * flattened column names into the public type, a collection that crept into a
 * list row, a private leaf that showed up in a public response, an index that
 * accepted a repeatable path - each is a bug the compiler is the only thing
 * that catches early, and each is asserted here rather than hoped for.
 */

const categoryContentType = defineContentType({
  fields: { name: field.text({ required: true }) },
  id: "test.d-category",
  tableName: "test_d_categories",
});

const seoGroup = field.group({
  fields: {
    description: field.textarea({ nullable: true }),
    title: field.text({ nullable: true }),
  },
  nullable: true,
});

const articleContentType = defineContentType({
  admin: {
    list: { columns: ["title"] },
    titleField: "title",
  },
  editorial: { enabled: true },
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
    seo: seoGroup,
    slug: field.slug({ source: "title" }),
    syndication: field.group({
      fields: { indexable: field.boolean({ defaultValue: true }) },
    }),
    title: field.text({ required: true }),
  },
  id: "test.d-article",
  publicApi: {
    enabled: true,
    fields: ["title", "slug", "categories", "seo.title", "faq.question"],
    path: "d-articles",
  },
  publication: { enabled: true },
  tableName: "test_d_articles",
});

type Article = typeof articleContentType;

describe("select values", () => {
  it("keeps a group nested and never leaks its column names", () => {
    expectTypeOf<ContentSelect<Article>>().toHaveProperty("seo");
    assertType<ContentSelect<Article>["seo"]>({
      description: null,
      title: "SEO",
    });
    assertType<ContentSelect<Article>["seo"]>(null);
    // The flattened name is an internal mapping and is absent from every
    // user-facing type.
    expectTypeOf<ContentSelect<Article>>().not.toHaveProperty("seoTitle");
  });

  it("keeps a non-nullable group non-nullable", () => {
    assertType<ContentSelect<Article>["syndication"]>({ indexable: true });
    // @ts-expect-error the group is not nullable, so neither is its value.
    assertType<ContentSelect<Article>["syndication"]>(null);
  });

  it("leaves collections out of a row", () => {
    // Two extra queries each: a list that carried them would issue one per row.
    expectTypeOf<ContentSelect<Article>>().not.toHaveProperty("categories");
    expectTypeOf<ContentSelect<Article>>().not.toHaveProperty("faq");
    expectTypeOf<ContentSelect<Article>>().not.toHaveProperty("related");
  });

  it("puts them on the detail read instead", () => {
    assertType<ContentAdvancedValues<Article>["categories"]>([1, 2]);
    assertType<ContentAdvancedValues<Article>["related"]>([3]);
    assertType<ContentAdvancedValues<Article>["faq"]>([
      { answer: "A", id: 11, question: "Q" },
    ]);
    assertType<ContentAdvancedValues<Article>["faq"]>([
      // @ts-expect-error a child always comes back with its identifier.
      { answer: "A", question: "Q" },
    ]);
    expectTypeOf<ContentDetail<Article>>().toHaveProperty("faq");
    expectTypeOf<ContentDetail<Article>>().toHaveProperty("title");
  });
});

describe("create values", () => {
  it("takes a nested group and a collection", () => {
    assertType<ContentCreateInput<Article>>({
      categories: [1, 2],
      faq: [{ answer: "A", question: "Q" }],
      seo: { title: "SEO" },
      title: "Hello",
    });
  });

  it("accepts null for a nullable group", () => {
    assertType<ContentCreateInput<Article>>({ seo: null, title: "Hello" });
  });

  it("lets a repeatable child name an existing id", () => {
    assertType<ContentCreateInput<Article>>({
      faq: [{ answer: "A", id: 11, question: "Q" }],
      title: "Hello",
    });
  });

  it("rejects a leaf the group does not declare", () => {
    assertType<ContentCreateInput<Article>>({
      // @ts-expect-error `seo` has `title` and `description`, not `keywords`.
      seo: { keywords: "no" },
      title: "Hello",
    });
  });

  it("rejects a flattened column name", () => {
    assertType<ContentCreateInput<Article>>({
      // @ts-expect-error the logical shape is nested; `seoTitle` is not a field.
      seoTitle: "no",
      title: "Hello",
    });
  });
});

describe("update values", () => {
  it("takes one leaf of a group without the others", () => {
    assertType<ContentUpdateInput<Article>>({
      seo: { description: "Just this" },
    });
  });

  it("takes a collection whole", () => {
    assertType<ContentUpdateInput<Article>>({ categories: [3] });
    assertType<ContentUpdateInput<Article>>({ related: [] });
  });

  it("still rejects an unknown leaf", () => {
    // @ts-expect-error partial does not mean permissive.
    assertType<ContentUpdateInput<Article>>({ seo: { keywords: "no" } });
  });

  it("rejects a to-many relation value that is not a list of ids", () => {
    // @ts-expect-error a collection is replaced whole, with identifiers.
    assertType<ContentUpdateInput<Article>>({ categories: [{ id: 3 }] });
  });
});

describe("changed paths", () => {
  it("names group leaves and collections, never a whole group", () => {
    expectTypeOf<"seo.title">().toExtend<ContentChangedPath<Article>>();
    expectTypeOf<"seo.description">().toExtend<ContentChangedPath<Article>>();
    expectTypeOf<"categories">().toExtend<ContentChangedPath<Article>>();
    expectTypeOf<"faq">().toExtend<ContentChangedPath<Article>>();
    expectTypeOf<"title">().toExtend<ContentChangedPath<Article>>();
    expectTypeOf<"seo">().not.toExtend<ContentChangedPath<Article>>();
  });
});

describe("filters", () => {
  it("takes a membership object for a to-many relation", () => {
    assertType<ContentFilterInput<Article>>({ categories: { contains: 7 } });
  });

  it("rejects a bare identifier for one", () => {
    // @ts-expect-error a to-many relation is not an equality filter.
    assertType<ContentFilterInput<Article>>({ categories: 7 });
  });
});

describe("public projection", () => {
  it("nests the exposed leaves and nothing else", () => {
    assertType<ContentPublicSelect<Article>["seo"]>({ title: "SEO" });
    assertType<ContentPublicSelect<Article>["seo"]>(null);
    // `seo.description` is not exposed, so it is absent from the type - and
    // therefore from the generated SELECT.
    assertType<ContentPublicSelect<Article>["seo"]>({
      // @ts-expect-error a private leaf is not part of the public shape.
      description: "leak",
      title: "SEO",
    });
  });

  it("exposes a to-many relation as identifiers", () => {
    assertType<ContentPublicSelect<Article>["categories"]>([1, 2]);
  });

  it("exposes a repeatable as its allowlisted leaves", () => {
    assertType<ContentPublicSelect<Article>["faq"]>([
      { id: 11, question: "Q" },
    ]);
    assertType<ContentPublicSelect<Article>["faq"]>([
      // @ts-expect-error `faq.answer` is not in `publicApi.fields`.
      { answer: "leak", id: 11, question: "Q" },
    ]);
  });

  it("omits a private collection entirely", () => {
    expectTypeOf<ContentPublicSelect<Article>>().not.toHaveProperty("related");
    expectTypeOf<ContentPublicSelect<Article>>().not.toHaveProperty(
      "syndication",
    );
  });

  it("refuses to expose a group whole", () => {
    type Exposable = ContentPublicExposableField<Article["fields"]>;

    expectTypeOf<"seo.title">().toExtend<Exposable>();
    expectTypeOf<"faq.answer">().toExtend<Exposable>();
    expectTypeOf<"categories">().toExtend<Exposable>();
    expectTypeOf<"seo">().not.toExtend<Exposable>();
    expectTypeOf<"faq">().not.toExtend<Exposable>();
  });
});

describe("indexes", () => {
  type Index = ContentIndexInput<Article["fields"], true, true>;

  it("accepts a group leaf path", () => {
    assertType<Index>({ on: ["seo.title"] });
  });

  it("rejects a repeatable leaf", () => {
    // @ts-expect-error a repeatable leaf is a column on a child table.
    assertType<Index>({ on: ["faq.question"] });
  });

  it("rejects a to-many relation", () => {
    // @ts-expect-error a to-many relation has no column to index.
    assertType<Index>({ on: ["categories"] });
  });

  it("rejects a group by name", () => {
    // @ts-expect-error a group is several columns rather than one.
    assertType<Index>({ on: ["seo"] });
  });
});

describe("admin surfaces", () => {
  it("refuse a collection as a list column", () => {
    defineContentType({
      admin: {
        // @ts-expect-error a to-many relation is not a column.
        list: { columns: ["tags"] },
      },
      fields: {
        name: field.text({ required: true }),
        tags: field.relation({
          multiple: true,
          target: () => categoryContentType,
        }),
      },
      id: "test.d-badlist",
      tableName: "test_d_badlist",
    });
  });
});

type Service = ReturnType<ContentModel<Article>["service"]>;
type Editorial = ReturnType<
  NonNullable<ContentModel<Article>["editorialService"]>
>;

declare const service: Service;
declare const editorial: Editorial;

describe("the typed collection API", () => {
  it("keys relations by the content type's actual collection names", () => {
    expectTypeOf<Service["relations"]>().toHaveProperty("categories");
    expectTypeOf<Service["relations"]>().toHaveProperty("related");
    // `Record<string, …>` accepted this and failed at runtime.
    expectTypeOf<Service["relations"]>().not.toHaveProperty(
      "thisFieldDoesNotExist",
    );
    // A repeatable is not a relation, and vice versa.
    expectTypeOf<Service["relations"]>().not.toHaveProperty("faq");
  });

  it("keys repeatables by the content type's actual repeatable names", () => {
    expectTypeOf<Service["repeatable"]>().toHaveProperty("faq");
    expectTypeOf<Service["repeatable"]>().not.toHaveProperty(
      "thisFieldDoesNotExist",
    );
    expectTypeOf<Service["repeatable"]>().not.toHaveProperty("categories");
  });

  it("types a relation helper's arguments", () => {
    expectTypeOf<Service["relations"]["categories"]["add"]>()
      .parameter(1)
      .toEqualTypeOf<number>();
    expectTypeOf<
      Service["relations"]["categories"]["get"]
    >().returns.resolves.toEqualTypeOf<number[]>();
  });

  it("infers a repeatable's create values from its own leaves", () => {
    void service.repeatable.faq.create(7, { answer: "A", question: "Q" });
    // @ts-expect-error `unknownField` is not a leaf of `faq`.
    void service.repeatable.faq.create(7, { unknownField: "no" });
    // @ts-expect-error `answer` is required.
    void service.repeatable.faq.create(7, { question: "Q" });
  });

  it("infers a repeatable's update values as a partial of the same leaves", () => {
    void service.repeatable.faq.update(7, 11, { answer: "A" });
    // @ts-expect-error partial does not mean permissive.
    void service.repeatable.faq.update(7, 11, { unknownField: "no" });
  });

  it("types what a repeatable lists", () => {
    assertType<Promise<{ answer: string; id: number; question: string }[]>>(
      service.repeatable.faq.list(7),
    );
    // Every child comes back with the identity a later edit addresses it by.
    expectTypeOf(service.repeatable.faq.list(7)).resolves.toHaveProperty(
      "length",
    );
  });

  it("requires an actor and a version on the editorial helpers", () => {
    void editorial.relations.categories.add(7, 1, {
      actor: { type: "staff", userId: 1 },
      expectedVersion: 3,
    });
    // @ts-expect-error the editorial API never writes without a version guard.
    void editorial.relations.categories.add(7, 1, {});
    // @ts-expect-error and never without an actor to attribute the revision to.
    void editorial.relations.categories.add(7, 1, { expectedVersion: 3 });
  });

  it("keeps the plain helpers free of an expected version", () => {
    // The plain service has no version column to guard on, so offering the
    // argument would be offering one it has to ignore.
    // @ts-expect-error use `editorialService.relations` for optimistic locking.
    void service.relations.categories.add(7, 1, { expectedVersion: 3 });
  });
});

describe("variance", () => {
  /**
   * A concrete model stays assignable to the erased one.
   *
   * Load-bearing, and easy to break by accident: every route builder, every
   * registry and every piece of background work is written against
   * {@link AnyContentModel}.
   *
   * Asserted against that alias rather than against
   * `ContentModel<AnyContentTypeDefinition>`, because `ContentModel` is
   * genuinely invariant in its definition - `create` takes it, `findMany`
   * returns it. Spelling the erased side `ContentModel<AnyContentTypeDefinition>`
   * only ever passed because TypeScript measured the parameter's variance and
   * skipped the structural check; `AnyContentModel` erases outright, so this
   * asserts the property the codebase actually depends on instead of a compiler
   * heuristic that can stop applying.
   */
  it("keeps a concrete model assignable to the erased one", () => {
    expectTypeOf<ContentModel<Article>>().toExtend<AnyContentModel>();
  });

  it("keeps the definition itself assignable", () => {
    expectTypeOf(articleContentType).toExtend<AnyContentTypeDefinition>();
  });
});
