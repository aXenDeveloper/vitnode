// @vitest-environment node
import { describe, expect, it } from "vitest";

import { testPostContentType } from "@/tests/content-fixtures";

import { defineContentType } from "./define";
import { field } from "./fields";

const label = { plural: "Widgets", singular: "Widget" };

const baseFields = {
  title: field.text({ required: true }),
  slug: field.slug({ source: "title" }),
  excerpt: field.textarea({ nullable: true }),
  views: field.number({ integer: true, defaultValue: 0 }),
  author: field.user(),
};

const define = ({
  fields = baseFields,
  publication = true,
  publicApi,
}: {
  fields?: Record<string, unknown>;
  publicApi?: Record<string, unknown>;
  publication?: boolean;
} = {}) =>
  defineContentType({
    id: "test.widget",
    tableName: "test_widgets",
    fields: fields as typeof baseFields,
    ...(publication ? { publication: { enabled: true as const } } : {}),
    publicApi: {
      enabled: true,
      path: "widgets",
      fields: ["title", "slug"],
      ...publicApi,
    } as never,
    admin: { label },
  });

describe("publicApi", () => {
  describe("defaults", () => {
    const resolved = define().publicApi;

    it("exposes nothing beyond the allowlist", () => {
      expect(resolved.fields).toEqual(["title", "slug"]);
    });

    it("filters and searches nothing until asked", () => {
      // Every public capability is opt-in. Reusing the admin allowlists here
      // would quietly publish whatever an editor happens to be able to sort by.
      expect(resolved.filterableFields).toEqual([]);
      expect(resolved.searchableFields).toEqual([]);
    });

    it("always allows ordering by publishedAt", () => {
      expect(resolved.orderableFields).toEqual(["publishedAt"]);
      expect(resolved.defaultOrderBy).toBe("publishedAt");
      expect(resolved.defaultOrder).toBe("desc");
    });

    it("records the slug the detail route resolves by", () => {
      expect(resolved.slugField).toBe("slug");
    });
  });

  it("is off, and empty, when the block is omitted", () => {
    const private_ = defineContentType({
      id: "test.private",
      tableName: "test_privates",
      fields: { title: field.text({ required: true }) },
      admin: { label },
    });

    expect(private_.publicApi.enabled).toBe(false);
    expect(private_.publicApi.fields).toEqual([]);
    expect(private_.publicApi.path).toBe("");
  });

  describe("prerequisites", () => {
    it("needs publication", () => {
      expect(() => define({ publication: false })).toThrow(
        /publicApi needs `publication/,
      );
    });

    it("needs an exposed slug field", () => {
      expect(() => define({ publicApi: { fields: ["title"] } })).toThrow(
        /exactly one slug field/,
      );
    });

    it("refuses two exposed slug fields", () => {
      expect(() =>
        define({
          fields: { ...baseFields, permalink: field.slug({ source: "title" }) },
          publicApi: { fields: ["title", "slug", "permalink"] },
        }),
      ).toThrow(/exposes 2 slug fields/);
    });

    it("accepts a second slug field as long as only one is exposed", () => {
      expect(
        define({
          fields: { ...baseFields, permalink: field.slug({ source: "title" }) },
          publicApi: { fields: ["title", "permalink"] },
        }).publicApi.slugField,
      ).toBe("permalink");
    });
  });

  describe("path", () => {
    it.each([
      ["Articles", "uppercase"],
      ["my_path", "underscore"],
      ["blog/articles", "slash"],
      ["/articles", "leading slash"],
      ["articles/", "trailing slash"],
      ["..", "traversal"],
      ["../articles", "traversal"],
      ["", "empty"],
      ["1articles", "leading digit"],
    ])("rejects %j (%s)", path => {
      expect(() => define({ publicApi: { path } })).toThrow(
        /must be one lowercase URL segment/,
      );
    });

    it("rejects a path past the length limit", () => {
      expect(() => define({ publicApi: { path: "a".repeat(65) } })).toThrow(
        /longer than 64/,
      );
    });

    it("rejects `admin`, which would trip the admin gate", () => {
      // The gate is a `path.includes("/admin/")` substring test, so a public
      // route under that name would demand a staff session.
      expect(() => define({ publicApi: { path: "admin" } })).toThrow(
        /is reserved/,
      );
    });

    it.each(["articles", "knowledge-base", "a"])("accepts %j", path => {
      expect(define({ publicApi: { path } }).publicApi.path).toBe(path);
    });
  });

  describe("fields", () => {
    it("rejects an unknown name", () => {
      expect(() =>
        define({ publicApi: { fields: ["title", "slug", "nope"] } }),
      ).toThrow(/unknown field "nope"/);
    });

    it("rejects a duplicate", () => {
      expect(() =>
        define({ publicApi: { fields: ["title", "slug", "title"] } }),
      ).toThrow(/lists "title" twice/);
    });

    it("rejects an empty list", () => {
      expect(() => define({ publicApi: { fields: [] } })).toThrow(
        /There is no wildcard/,
      );
    });

    it("rejects a user field", () => {
      // The one kind that resolves to a person. Publishing one should never be
      // a one-word change.
      expect(() =>
        define({ publicApi: { fields: ["title", "slug", "author"] } }),
      ).toThrow(/User fields are not exposable/);
    });

    it("rejects `status`, which is a constant publicly", () => {
      expect(() =>
        define({ publicApi: { fields: ["title", "slug", "status"] } }),
      ).toThrow(/every row the public API returns is published/i);
    });

    it.each(["id", "createdAt", "updatedAt", "publishedAt"])(
      "accepts the generated column %s",
      name => {
        expect(
          define({ publicApi: { fields: ["title", "slug", name] } }).publicApi
            .fields,
        ).toContain(name);
      },
    );

    it("accepts every exposable declared kind", () => {
      const fields = {
        ...baseFields,
        flag: field.boolean({ defaultValue: false }),
        state: field.enum({ defaultValue: "a", values: ["a", "b"] }),
        when: field.dateTime({ nullable: true }),
      };

      expect(
        define({
          fields,
          publicApi: {
            fields: [
              "title",
              "slug",
              "excerpt",
              "views",
              "flag",
              "state",
              "when",
            ],
          },
        }).publicApi.fields,
      ).toHaveLength(7);
    });
  });

  describe("subset rules", () => {
    // Every one of these exists so a private field cannot be probed sideways.
    it.each([
      ["searchableFields", { searchableFields: ["excerpt"] }],
      ["filterableFields", { filterableFields: ["views"] }],
      ["orderableFields", { orderableFields: ["views"] }],
    ])("rejects a private field in %s", (_name, publicApi) => {
      expect(() => define({ publicApi })).toThrow(
        /which is not in publicApi.fields/,
      );
    });

    it("rejects a searchable field that is not text-like", () => {
      expect(() =>
        define({
          publicApi: {
            fields: ["title", "slug", "views"],
            searchableFields: ["views"],
          },
        }),
      ).toThrow(/not a text, textarea or slug field/);
    });

    it("rejects a filterable field of a non-filterable kind", () => {
      expect(() =>
        define({
          publicApi: {
            fields: ["title", "slug", "excerpt"],
            filterableFields: ["excerpt"],
          },
        }),
      ).toThrow(/not an equality-filterable field/);
    });

    it("rejects a defaultOrderBy outside the orderable set", () => {
      expect(() => define({ publicApi: { defaultOrderBy: "title" } })).toThrow(
        /not in publicApi.orderableFields/,
      );
    });

    it("accepts a defaultOrderBy that was made orderable", () => {
      expect(
        define({
          publicApi: { defaultOrderBy: "title", orderableFields: ["title"] },
        }).publicApi.defaultOrderBy,
      ).toBe("title");
    });
  });

  describe("generated schemas", () => {
    const { schemas } = testPostContentType;

    it("projects exactly the allowlisted fields", () => {
      expect(Object.keys(schemas.publicSelectObject.shape).sort()).toEqual([
        "category",
        "excerpt",
        "publishedAt",
        "slug",
        "title",
      ]);
    });

    it("leaves private fields out of the projection", () => {
      const keys = Object.keys(schemas.publicSelectObject.shape);

      expect(keys).not.toContain("views");
      expect(keys).not.toContain("author");
      expect(keys).not.toContain("status");
      expect(keys).not.toContain("id");
    });

    it("projects a relation as an identifier and nothing else", () => {
      // Read back through the whole object: `shape[...]` is typed as the base
      // Zod interface, which has no `safeParse`.
      const row = {
        category: { id: 3 },
        excerpt: null,
        publishedAt: new Date(),
        slug: "hello",
        title: "Hello",
      };

      expect(schemas.publicSelectObject.safeParse(row).success).toBe(true);
      // Not the related row - one level, one key, no population.
      expect(
        schemas.publicSelectObject.safeParse({ ...row, category: 3 }).success,
      ).toBe(false);
    });

    it("strips a label off a relation rather than publishing it", () => {
      // The target's `admin.titleField` is not the public API's to give away.
      const parsed = schemas.publicSelectObject.safeParse({
        category: { id: 3, label: "News" },
        excerpt: null,
        publishedAt: new Date(),
        slug: "hello",
        title: "Hello",
      });

      expect(parsed.success).toBe(true);
      expect(parsed.data?.category).toEqual({ id: 3 });
    });

    it("accepts only the configured public filters", () => {
      expect(Object.keys(schemas.publicFilters.shape)).toEqual(["category"]);
    });

    it("accepts only the configured public order columns", () => {
      expect(
        schemas.publicOrder.safeParse({ orderBy: "publishedAt" }).success,
      ).toBe(true);
      expect(schemas.publicOrder.safeParse({ orderBy: "title" }).success).toBe(
        true,
      );
      // Private, and not in `orderableFields` either.
      expect(schemas.publicOrder.safeParse({ orderBy: "views" }).success).toBe(
        false,
      );
    });

    it("takes a slug as the public detail parameter", () => {
      expect(schemas.publicParams.parse({ slug: "hello" })).toEqual({
        slug: "hello",
      });
      expect(schemas.publicParams.safeParse({ slug: "" }).success).toBe(false);
    });
  });
});

describe("publicApi on a localized content type", () => {
  const localized = (publicApi: Record<string, unknown>) =>
    defineContentType({
      id: "test.public-localized",
      tableName: "test_public_localized",
      localization: { defaultLocale: "en", enabled: true },
      publication: { enabled: true },
      fields: {
        title: field.text({ localized: true, required: true }),
        slug: field.slug({ localized: true, source: "title" }),
        featured: field.boolean({ defaultValue: false }),
      },
      admin: { label: { plural: "Localized", singular: "Localized" } },
      publicApi,
    } as never);

  it("exposes a localized field alongside a shared one", () => {
    const definition = localized({
      enabled: true,
      fields: ["title", "slug", "featured"],
      path: "localized",
    });

    // A public localized response is a base row joined to a translation, so
    // where a value is stored is a fact about the query, not the response.
    expect(Object.keys(definition.schemas.publicSelectObject.shape)).toContain(
      "title",
    );
  });

  it("refuses a localized field in `orderableFields`", () => {
    // A list ordered by a localized title reshuffles per language, and one
    // cursor would mean two positions across a fallback set.
    expect(() =>
      localized({
        enabled: true,
        fields: ["title", "slug"],
        orderableFields: ["title"],
        path: "localized",
      }),
    ).toThrow(/localized field "title"/);
  });

  it("allows a localized field in `filterableFields`", () => {
    const definition = localized({
      enabled: true,
      fields: ["title", "slug"],
      filterableFields: ["slug"],
      path: "localized",
    });

    expect(Object.keys(definition.schemas.publicFilters.shape)).toEqual([
      "slug",
    ]);
  });

  it("allows a localized field in `searchableFields`", () => {
    expect(
      localized({
        enabled: true,
        fields: ["title", "slug"],
        path: "localized",
        searchableFields: ["title"],
      }).publicApi.searchableFields,
    ).toEqual(["title"]);
  });

  it("reserves `locale`, which the response already carries", () => {
    expect(() =>
      defineContentType({
        id: "test.public-locale-clash",
        tableName: "test_public_locale_clash",
        localization: { defaultLocale: "en", enabled: true },
        publication: { enabled: true },
        fields: {
          title: field.text({ localized: true, required: true }),
          slug: field.slug({ localized: true, source: "title" }),
          locale: field.text({ nullable: true }),
        },
        admin: { label: { plural: "Clash", singular: "Clash" } },
        publicApi: {
          enabled: true,
          fields: ["title", "slug", "locale"],
          path: "clash",
        },
      } as never),
    ).toThrow(/reserves/);
  });

  it("leaves a field called `locale` alone when nothing is localized", () => {
    // The reservation is a consequence of localization, not a global rename.
    expect(
      () =>
        defineContentType({
          id: "test.public-locale-plain",
          tableName: "test_public_locale_plain",
          publication: { enabled: true },
          fields: {
            slug: field.slug({}),
            locale: field.text({ nullable: true }),
          },
          admin: { label: { plural: "Plain", singular: "Plain" } },
          publicApi: {
            enabled: true,
            fields: ["slug", "locale"],
            path: "plain",
          },
        } as never).publicApi.fields,
    ).not.toThrow();
  });
});
