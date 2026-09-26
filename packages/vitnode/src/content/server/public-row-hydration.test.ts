// @vitest-environment node
import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { PgDialect } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import {
  testFileGalleryContentType,
  testFilePostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";
import { runtimeImports } from "@/tests/import-graph";

import type { ContentAdvancedStore } from "./advanced-store";

import {
  createContentPublicRowHydrator,
  nestContentPublicRow,
} from "./public-row-hydration";

const here = dirname(fileURLToPath(import.meta.url));

const dialect = new PgDialect();

const order: string[] = [];

const loadMany = vi.fn(
  async (
    itemIds: readonly number[],
    _db: unknown,
    only?: readonly string[],
  ) => {
    order.push("collections");

    return Promise.resolve(
      new Map(
        itemIds.map(id => [
          id,
          Object.fromEntries((only ?? []).map(field => [field, [id * 10]])),
        ]),
      ),
    );
  },
);

const advanced = { loadMany } as unknown as ContentAdvancedStore;

const fileRow = (id: number) => ({
  id,
  key: `uploads/${id}.png`,
  metadata: null,
  mimeType: "image/png",
  name: `${id}.png`,
  size: 100,
});

const descriptor = (id: number) => ({
  id,
  mimeType: "image/png",
  name: `${id}.png`,
  size: 100,
  url: `https://cdn.test/uploads/${id}.png`,
});

const fileQueries: unknown[][] = [];

const db = {
  select: () => ({
    from: () => ({
      where: async (condition: SQL) => {
        order.push("files");
        const { params } = dialect.sqlToQuery(condition);
        fileQueries.push(params);

        return await Promise.resolve(
          params.filter(id => typeof id === "number").map(fileRow),
        );
      },
    }),
  }),
};

const store: Record<string, unknown> = {
  core: { storage: { adapter: {} } },
  db,
  storage: { getUrl: (key: string) => `https://cdn.test/${key}` },
};

const c = { get: (key: string) => store[key] } as unknown as Context;

beforeEach(() => {
  order.length = 0;
  fileQueries.length = 0;
  loadMany.mockClear();
});

const hydrator = (
  publicCollections: readonly string[],
  definition: AnyContentTypeDefinition = testPostContentType,
) =>
  createContentPublicRowHydrator({
    advanced,
    c,
    definition,
    publicCollections,
  });

describe("nesting", () => {
  it("puts a group's leaves back under their owner", () => {
    expect(
      nestContentPublicRow({ "seo.title": "T", id: 1, "seo.description": "D" }),
    ).toEqual({ id: 1, seo: { description: "D", title: "T" } });
  });

  it("leaves a flat column alone", () => {
    expect(nestContentPublicRow({ id: 1, title: "Hello" })).toEqual({
      id: 1,
      title: "Hello",
    });
  });

  it("runs first, so a nested id is what the collections are keyed by", async () => {
    await hydrator(["tags"])([{ "seo.title": "T", id: 4 }]);

    expect(loadMany).toHaveBeenCalledWith([4], db, ["tags"]);
  });
});

describe("an empty list", () => {
  it("loads nothing at all", async () => {
    await expect(
      hydrator(["gallery"], testFileGalleryContentType)([]),
    ).resolves.toEqual([]);

    expect(loadMany).not.toHaveBeenCalled();
    expect(fileQueries).toEqual([]);
  });

  it("short-circuits even when there is nothing to load either", async () => {
    await expect(hydrator([], testFileGalleryContentType)([])).resolves.toEqual(
      [],
    );

    expect(order).toEqual([]);
  });
});

describe("the collections", () => {
  it("load only when the allowlist exposes one", async () => {
    await hydrator([])([{ id: 1 }]);

    expect(loadMany).not.toHaveBeenCalled();
  });

  it("load exactly the exposed fields and nothing more", async () => {
    await hydrator(["tags", "related"])([{ id: 1 }, { id: 2 }]);

    expect(loadMany).toHaveBeenCalledTimes(1);
    expect(loadMany.mock.calls[0][0]).toEqual([1, 2]);
    expect(loadMany.mock.calls[0][2]).toEqual(["tags", "related"]);
  });

  it("attach to the row they belong to", async () => {
    const rows = await hydrator(["tags"])([{ id: 1 }, { id: 2 }]);

    expect(rows[0]).toMatchObject({ id: 1, tags: [10] });
    expect(rows[1]).toMatchObject({ id: 2, tags: [20] });
  });

  it("skip a row with no numeric id rather than mis-keying it", async () => {
    const rows = await hydrator(["tags"])([{ id: "not-a-number" }]);

    expect(loadMany.mock.calls[0][0]).toEqual([]);
    expect(rows[0]).not.toHaveProperty("tags");
  });
});

describe("the file fields", () => {
  it("resolve after the collections are attached", async () => {
    const rows = await hydrator(
      ["gallery"],
      testFileGalleryContentType,
    )([{ id: 1 }]);

    // A `multiple: true` file field has no column: its identifiers only exist
    // on the row once `loadMany` has put them there.
    expect(order).toEqual(["collections", "files"]);
    expect(rows[0].gallery).toEqual([descriptor(10)]);
  });

  it("resolve on the rows the collections were merged into", async () => {
    const rows = await hydrator(
      ["gallery"],
      testFileGalleryContentType,
    )([{ id: 1 }, { id: 2 }]);

    expect(fileQueries).toEqual([[10, 20]]);
    expect(rows[0]).toMatchObject({ gallery: [descriptor(10)], id: 1 });
    expect(rows[1]).toMatchObject({ gallery: [descriptor(20)], id: 2 });
  });

  it("still resolve when there is no collection to load", async () => {
    const rows = await hydrator(
      [],
      testFileGalleryContentType,
    )([{ cover: 3, id: 1 }]);

    expect(order).toEqual(["files"]);
    expect(rows[0]).toMatchObject({ cover: descriptor(3) });
  });

  it("are handed the definition whose allowlist decides which ones are public", async () => {
    const rows = await createContentPublicRowHydrator({
      advanced,
      c,
      definition: testFilePostContentType,
      publicCollections: [],
    })([{ animation: 5, cover: 3, document: 4, id: 1 }]);

    expect(fileQueries).toEqual([[3]]);
    expect(rows[0]).toMatchObject({
      animation: 5,
      cover: descriptor(3),
      document: 4,
    });
  });
});

describe("both public services", () => {
  it("read their hydration out of this module rather than declaring it", () => {
    for (const file of ["public-service.ts", "localized-public-service.ts"]) {
      const source = readFileSync(join(here, file), "utf8");

      expect(runtimeImports(join(here, file))).toContain(
        "./public-row-hydration",
      );
      // The duplication this module removed: thirty-odd identical lines, twice.
      expect(source).not.toMatch(/const withCollections = async \(/);
    }
  });
});

describe("a content type with no collection store", () => {
  it("hydrates the rows without one", async () => {
    const rows = await createContentPublicRowHydrator({
      c,
      definition: testFilePostContentType,
      publicCollections: ["tags"],
    })([{ cover: 3, id: 1 }]);

    expect(rows[0]).toMatchObject({ cover: descriptor(3), id: 1 });
    expect(order).toEqual(["files"]);
  });
});
