import { describe, expect, it } from "vitest";

import type { ContentFieldMap } from "./types";

import { CONTENT_IDENTIFIER_MAX_LENGTH } from "./const";
import { ContentEngineError } from "./errors";
import { field } from "./fields";
import {
  contentIndexName,
  resolveContentIndexes,
  shortenIdentifier,
  toSnakeCase,
} from "./indexes";

const fields = {
  category: field.relation({
    required: true,
    target: () => {
      throw new Error("not evaluated");
    },
  }),
  code: field.text({ required: true, unique: true }),
  status: field.enum({ defaultValue: "draft", values: ["draft", "live"] }),
  title: field.text({ required: true }),
} satisfies ContentFieldMap;

const resolve = (
  declared: { name?: string; on: string[]; unique?: boolean }[] = [],
  fieldMap: ContentFieldMap = fields,
) =>
  resolveContentIndexes({
    contentTypeId: "test.thing",
    declared,
    fields: fieldMap,
    tableName: "test_things",
  });

const namesOf = (declared?: { name?: string; on: string[] }[]) =>
  resolve(declared).map(index => index.name);

describe("toSnakeCase", () => {
  it("splits camelCase the way the SQL identifiers do", () => {
    expect(toSnakeCase("createdAt")).toBe("created_at");
    expect(toSnakeCase("publishedAtUtc")).toBe("published_at_utc");
  });

  it("leaves an already snake_case name alone", () => {
    expect(toSnakeCase("created_at")).toBe("created_at");
  });
});

describe("shortenIdentifier", () => {
  const long = (length: number) => "a".repeat(length);

  it("leaves a name inside the limit untouched", () => {
    const name = long(CONTENT_IDENTIFIER_MAX_LENGTH);

    expect(shortenIdentifier(name)).toBe(name);
  });

  it("keeps the result inside the Postgres limit", () => {
    expect(shortenIdentifier(long(200))).toHaveLength(
      CONTENT_IDENTIFIER_MAX_LENGTH,
    );
  });

  it("is deterministic", () => {
    expect(shortenIdentifier(long(200))).toBe(shortenIdentifier(long(200)));
  });

  it("does not collide when only the tail differs", () => {
    // Plain truncation would map both of these onto the same identifier, which
    // is exactly the failure mode the fingerprint exists to prevent.
    const first = `${long(70)}_alpha_idx`;
    const second = `${long(70)}_beta_idx`;

    expect(shortenIdentifier(first)).not.toBe(shortenIdentifier(second));
  });
});

describe("contentIndexName", () => {
  it("builds a deterministic snake_case name", () => {
    expect(
      contentIndexName({
        columns: ["status", "createdAt"],
        tableName: "posts",
      }),
    ).toBe("posts_status_created_at_idx");
  });

  it("uses the Postgres `_key` suffix for unique indexes", () => {
    expect(
      contentIndexName({ columns: ["code"], tableName: "posts", unique: true }),
    ).toBe("posts_code_key");
  });

  it("stays valid for very long table and column names", () => {
    const name = contentIndexName({
      columns: ["someExtremelyDescriptiveColumnName"],
      tableName: "a_very_long_plugin_scoped_content_table_name_indeed",
    });

    expect(name.length).toBeLessThanOrEqual(CONTENT_IDENTIFIER_MAX_LENGTH);
    expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("resolveContentIndexes", () => {
  it("indexes the timestamps and every foreign key", () => {
    expect(namesOf()).toEqual(
      expect.arrayContaining([
        "test_things_category_idx",
        "test_things_created_at_idx",
        "test_things_updated_at_idx",
      ]),
    );
  });

  it("adds a unique index for `field.text({ unique: true })`", () => {
    const code = resolve().find(index => index.name === "test_things_code_key");

    expect(code).toEqual({
      name: "test_things_code_key",
      on: ["code"],
      unique: true,
    });
  });

  it("leaves a plain text field unindexed", () => {
    expect(namesOf()).not.toContain("test_things_title_idx");
    expect(namesOf()).not.toContain("test_things_title_key");
  });

  it("never emits two indexes on the same columns", () => {
    const signatures = resolve([
      { on: ["category"] },
      { on: ["code"], unique: true },
    ]).map(index => index.on.join(","));

    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("lets a declared index rename the automatic foreign-key one", () => {
    const resolved = resolve([
      { name: "custom_category_idx", on: ["category"] },
    ]);

    expect(resolved.map(index => index.name)).toContain("custom_category_idx");
    expect(resolved.map(index => index.name)).not.toContain(
      "test_things_category_idx",
    );
  });

  it("keeps uniqueness when a declared index covers a unique field", () => {
    const resolved = resolve([{ name: "custom_code_idx", on: ["code"] }]);
    const code = resolved.find(index => index.name === "custom_code_idx");

    expect(code?.unique).toBe(true);
    expect(resolved.map(index => index.name)).not.toContain(
      "test_things_code_key",
    );
  });

  it("treats column order as part of the index identity", () => {
    const resolved = resolve([
      { on: ["status", "title"] },
      { on: ["title", "status"] },
    ]);

    expect(resolved.map(index => index.name)).toEqual(
      expect.arrayContaining([
        "test_things_status_title_idx",
        "test_things_title_status_idx",
      ]),
    );
  });

  it("is deterministic across calls", () => {
    expect(resolve([{ on: ["status", "title"] }])).toEqual(
      resolve([{ on: ["status", "title"] }]),
    );
  });

  describe("validation", () => {
    it("rejects an empty column list", () => {
      expect(() => resolve([{ on: [] }])).toThrow(/at least one column/);
    });

    it("rejects a column repeated inside one index", () => {
      expect(() => resolve([{ on: ["status", "status"] }])).toThrow(
        /lists "status" twice/,
      );
    });

    it("rejects two declared indexes on the same columns", () => {
      expect(() =>
        resolve([{ on: ["status", "title"] }, { on: ["status", "title"] }]),
      ).toThrow(/declared on the same columns/);
    });

    it("rejects a duplicate explicit index name", () => {
      expect(() =>
        resolve([
          { name: "shared_idx", on: ["status"] },
          { name: "shared_idx", on: ["title"] },
        ]),
      ).toThrow(/declared twice/);
    });

    it("rejects an explicit name that is not a Postgres identifier", () => {
      expect(() => resolve([{ name: "Bad Name!", on: ["status"] }])).toThrow(
        /must be snake_case/,
      );
    });

    it("rejects an explicit name past the identifier limit", () => {
      expect(() =>
        resolve([{ name: `x${"y".repeat(63)}`, on: ["status"] }]),
      ).toThrow(/identifier limit/);
    });

    it("rejects two indexes that resolve to the same name", () => {
      expect(() =>
        resolve([
          { name: "test_things_created_at_idx", on: ["status"] },
          { on: ["createdAt"] },
        ]),
      ).toThrow(ContentEngineError);
    });
  });
});
