import { describe, expect, it } from "vitest";

import { defineContentType } from "./define";
import { field } from "./fields";

/**
 * Definition-time validation for Stage 6.
 *
 * Every case here is a mistake whose *first* symptom would otherwise be a query
 * against a table that does not exist, a column two fields quietly share, or a
 * localized list nothing knows how to reorder. They fail at import time, which
 * is to say before the process serves anything.
 */

const base = {
  admin: { label: { plural: "Things", singular: "Thing" } },
  id: "test.advanced",
  tableName: "test_advanced",
} as const;

const target = defineContentType({
  admin: { label: { plural: "Targets", singular: "Target" } },
  fields: { name: field.text({ required: true }) },
  id: "test.target",
  tableName: "test_targets",
});

describe("relations", () => {
  it("generates one junction table per to-many field", () => {
    const definition = defineContentType({
      ...base,
      fields: {
        name: field.text({ required: true }),
        tags: field.relation({ multiple: true, target: () => target }),
      },
    });

    expect(definition.advanced.junctions).toStrictEqual([
      {
        field: "tags",
        positionIndexName: "test_advanced_tags_position_key",
        primaryKeyName: "test_advanced_tags_pk",
        relatedIndexName: "test_advanced_tags_related_item_id_idx",
        tableName: "test_advanced_tags",
      },
    ]);
  });

  it("snake_cases a camelCase field name into its table name", () => {
    const definition = defineContentType({
      ...base,
      fields: {
        name: field.text({ required: true }),
        relatedThings: field.relation({ multiple: true, target: () => target }),
      },
    });

    expect(definition.advanced.junctions[0].tableName).toBe(
      "test_advanced_related_things",
    );
  });

  it("binds a `self: true` relation to the definition being built", () => {
    const selfReferential = defineContentType({
      ...base,
      fields: {
        name: field.text({ required: true }),
        // No `target`, and deliberately so: `() => selfReferential` would make
        // the definition's own inferred type circular, and TypeScript widens
        // that to `any` rather than reporting it.
        related: field.relation({ multiple: true, ordered: true, self: true }),
      },
    });

    expect(selfReferential.advanced.junctions[0].tableName).toBe(
      "test_advanced_related",
    );
    expect(selfReferential.fields.related.target().id).toBe("test.advanced");
    expect(selfReferential.fields.related.target()).toBe(selfReferential);
  });

  it("does not mutate the descriptor a caller passed in", () => {
    const shared = field.relation({ multiple: true, self: true });

    const first = defineContentType({
      ...base,
      fields: { name: field.text({ required: true }), related: shared },
    });
    const second = defineContentType({
      ...base,
      id: "test.other",
      fields: { name: field.text({ required: true }), related: shared },
      tableName: "test_other",
    });

    // A descriptor const reused by two content types must not end up pointing
    // both relations at whichever one was declared last.
    expect(first.fields.related.target().id).toBe("test.advanced");
    expect(second.fields.related.target().id).toBe("test.other");
  });

  it("generates no junction table for a to-one relation", () => {
    const definition = defineContentType({
      ...base,
      fields: {
        name: field.text({ required: true }),
        one: field.relation({ nullable: true, target: () => target }),
      },
    });

    expect(definition.advanced.junctions).toStrictEqual([]);
  });

  it("rejects `ordered` without `multiple`", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          one: field.relation({
            nullable: true,
            ordered: true,
            target: () => target,
          }),
        },
      }),
    ).toThrow(/One target has no order/);
  });

  it("rejects `required` on a to-many relation", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          many: field.relation({
            multiple: true,
            required: true,
            target: () => target,
          }),
        },
      }),
    ).toThrow(/the empty set is what "no targets" looks like/);
  });

  it('rejects `onDelete: "set null"` on a to-many relation', () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          many: field.relation({
            multiple: true,
            onDelete: "set null",
            target: () => target,
          }),
        },
      }),
    ).toThrow(/nothing to null/);
  });

  it("rejects a localized to-many relation", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          many: field.relation({
            localized: true,
            multiple: true,
            target: () => target,
          } as never),
        },
        localization: { defaultLocale: "en", enabled: true },
      }),
    ).toThrow(/per-locale references are out of scope/);
  });
});

describe("groups", () => {
  const seo = {
    description: field.textarea({ nullable: true }),
    title: field.text({ nullable: true }),
  };

  it("maps every leaf to a canonical path and a column", () => {
    const definition = defineContentType({
      ...base,
      fields: {
        name: field.text({ required: true }),
        seo: field.group({ fields: seo }),
      },
    });

    expect(definition.advanced.leaves).toStrictEqual([
      {
        columnName: "seoDescription",
        group: "seo",
        leaf: "description",
        localized: false,
        path: "seo.description",
      },
      {
        columnName: "seoTitle",
        group: "seo",
        leaf: "title",
        localized: false,
        path: "seo.title",
      },
    ]);
  });

  it("marks the leaves of a localized group", () => {
    const definition = defineContentType({
      ...base,
      fields: {
        name: field.text({ required: true }),
        seo: field.group({ fields: seo, localized: true }),
      },
      localization: { defaultLocale: "en", enabled: true },
    });

    expect(definition.advanced.leaves.every(leaf => leaf.localized)).toBe(true);
  });

  it("rejects a localized leaf inside a group", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          seo: field.group({
            fields: { title: field.text({ localized: true, nullable: true }) },
          }),
        },
        localization: { defaultLocale: "en", enabled: true },
      }),
    ).toThrow(/Localization is a property of the whole group/);
  });

  it("rejects a nested group", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          outer: field.group({
            fields: {
              inner: field.group({
                fields: { title: field.text({ nullable: true }) },
              }),
            } as never,
          }),
        },
      }),
    ).toThrow(/cannot sit inside a group/);
  });

  it("rejects a relation inside a group", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          meta: field.group({
            fields: {
              owner: field.relation({ target: () => target }),
            } as never,
          }),
        },
      }),
    ).toThrow(/cannot sit inside a group/);
  });

  it("rejects a slug inside a group", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          meta: field.group({ fields: { url: field.slug() } as never }),
        },
      }),
    ).toThrow(/cannot sit inside a group/);
  });

  it("rejects an empty group", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          empty: field.group({ fields: {} }),
          name: field.text({ required: true }),
        },
      }),
    ).toThrow(/declares no leaves/);
  });

  it("rejects a nullable group with a non-nullable leaf", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          seo: field.group({
            fields: { title: field.text({ required: true }) },
            nullable: true,
          }),
        },
      }),
    ).toThrow(/setting it to null has to blank every leaf/);
  });

  it("rejects an optional group whose leaf has nothing to fall back to", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          seo: field.group({
            fields: { title: field.text({ required: true }) },
          }),
        },
      }),
    ).toThrow(/every leaf needs a value it can fall back to/);
  });

  it("accepts a required group with a required leaf", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          seo: field.group({
            fields: { title: field.text({ required: true }) },
            required: true,
          }),
        },
      }),
    ).not.toThrow();
  });

  it("rejects a leaf whose column collides with a declared field", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          seo: field.group({
            fields: { title: field.text({ nullable: true }) },
          }),
          // Compiles to the same column the leaf does.
          seoTitle: field.text({ nullable: true }),
        },
      }),
    ).toThrow(/already declares as a field/);
  });

  it("rejects a localized leaf that shadows a translation column", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          // `item` + `Id` compiles to `itemId`, which every translation table
          // generates for itself.
          item: field.group({
            fields: { id: field.text({ nullable: true }) },
            localized: true,
          }),
          name: field.text({ required: true }),
        },
        localization: { defaultLocale: "en", enabled: true },
      }),
    ).toThrow(/the translation table generates for itself/);
  });
});

describe("repeatables", () => {
  const faq = {
    answer: field.textarea({ required: true }),
    question: field.text({ required: true }),
  };

  it("generates one child table per repeatable field", () => {
    const definition = defineContentType({
      ...base,
      fields: {
        faq: field.repeatable({ fields: faq }),
        name: field.text({ required: true }),
      },
    });

    expect(definition.advanced.repeatables).toStrictEqual([
      {
        field: "faq",
        positionIndexName: "test_advanced_faq_position_key",
        tableName: "test_advanced_faq",
      },
    ]);
  });

  it("rejects a localized repeatable", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          faq: field.repeatable({ fields: faq, localized: true } as never),
          name: field.text({ required: true }),
        },
        localization: { defaultLocale: "en", enabled: true },
      }),
    ).toThrow(/Repeatable fields are shared in Stage 6/);
  });

  it("rejects a localized leaf inside a repeatable", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          faq: field.repeatable({
            fields: {
              question: field.text({ localized: true, required: true }),
            },
          }),
          name: field.text({ required: true }),
        },
        localization: { defaultLocale: "en", enabled: true },
      }),
    ).toThrow(/repeatable fields are shared in Stage 6/);
  });

  it("rejects a leaf that shadows a generated child column", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          faq: field.repeatable({
            fields: { position: field.text({ required: true }) },
          }),
          name: field.text({ required: true }),
        },
      }),
    ).toThrow(/collides with a generated column/);
  });

  it("rejects an out-of-range max", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          faq: field.repeatable({ fields: faq, max: 0 }),
          name: field.text({ required: true }),
        },
      }),
    ).toThrow(/must be a whole number between 1 and/);
  });

  it("refuses two fields that would generate the same table", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          // Both snake_case to `test_advanced_faq_items`.
          faqItems: field.repeatable({ fields: faq }),
          faq_items: field.repeatable({ fields: faq }) as never,
          name: field.text({ required: true }),
        },
      }),
    ).toThrow(/must be camelCase|already used by/);
  });
});

describe("indexes over advanced fields", () => {
  it("materialises a leaf path against its generated column", () => {
    const definition = defineContentType({
      ...base,
      fields: {
        name: field.text({ required: true }),
        seo: field.group({
          fields: { code: field.text({ nullable: true }) },
        }),
      },
      indexes: [{ on: ["seo.code"], unique: true }],
    });

    const declared = definition.indexes.find(index =>
      index.on.includes("seoCode"),
    );

    expect(declared?.unique).toBe(true);
    expect(declared?.name).toBe("test_advanced_seo_code_key");
  });

  it("refuses a repeatable leaf rather than dropping it silently", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          faq: field.repeatable({
            fields: { answer: field.textarea({ required: true }) },
          }),
          name: field.text({ required: true }),
        },
        indexes: [{ on: ["faq.answer"] as never }],
      }),
    ).toThrow(/columns on a generated child table/);
  });

  it("refuses a to-many relation", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          tags: field.relation({ multiple: true, target: () => target }),
        },
        indexes: [{ on: ["tags"] as never }],
      }),
    ).toThrow(/its values live in a generated junction table/);
  });

  it("refuses a whole group", () => {
    expect(() =>
      defineContentType({
        ...base,
        fields: {
          name: field.text({ required: true }),
          seo: field.group({
            fields: { code: field.text({ nullable: true }) },
          }),
        },
        indexes: [{ on: ["seo"] as never }],
      }),
    ).toThrow(/several columns rather than one/);
  });
});

describe("stage 1-5 content types", () => {
  it("resolve to an empty advanced config", () => {
    const flat = defineContentType({
      ...base,
      fields: {
        category: field.relation({ nullable: true, target: () => target }),
        name: field.text({ required: true }),
      },
    });

    expect(flat.advanced).toStrictEqual({
      junctions: [],
      leaves: [],
      repeatables: [],
    });
  });
});
