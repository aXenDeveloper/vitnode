import type { Context } from "hono";

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { searchIndexFilters } from "./search-filters";

const c = { get: () => undefined } as unknown as Context;

const render = (accessScopes?: null | string[]) => {
  const condition = searchIndexFilters(c, {
    accessScopes,
    includePrivate: true,
  });

  return condition ? new PgDialect().sqlToQuery(condition) : undefined;
};

describe("searchIndexFilters access scopes", () => {
  it.each([[["forum.forums:1", "blog.category:3"]], [[]]])(
    "keeps a row only when every scope it is filed in is in %j",
    allowed => {
      expect(render(allowed)).toEqual({
        params: [allowed],
        sql: '"core_search_index"."accessScopes" <@ $1::text[]',
        typings: undefined,
      });
    },
  );

  it.each([undefined, null])("adds no access filter for %s", allowed => {
    expect(render(allowed)).toBeUndefined();
  });
});
