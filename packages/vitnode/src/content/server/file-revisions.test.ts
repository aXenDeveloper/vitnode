// @vitest-environment node
import type { Context } from "hono";

import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  core_content_file_refs,
  core_content_revisions,
} from "@/database/content";
import { core_files } from "@/database/files";
import {
  testEditorialPostContentType,
  testFilePostContentType,
} from "@/tests/content-fixtures";

import type { ContentDatabase } from "./service";

import { contentSnapshotFileIds } from "./files";
import { contentRevisionSnapshot } from "./revision-snapshot";
import { createContentRevisionsModel } from "./revisions-model";

const PLUGIN_ID = "@vitnode/example";

/**
 * A transaction stand-in that records what was inserted into which table and
 * what was deleted.
 *
 * The pin insert and the retention prune happen inside `capture`, in one
 * transaction, so a stub at this level is what proves the ordering: the pins
 * exist before anything is pruned, and there is no unpinning step at all.
 */
const makeTx = () => {
  const inserts: { table: string; values: unknown }[] = [];
  const deletes: string[] = [];

  const tx = {
    delete: (table: object) => {
      deletes.push(getTableName(table as never));

      return { where: async () => await Promise.resolve(undefined) };
    },
    insert: (table: object) => ({
      values: (values: unknown) => {
        inserts.push({ table: getTableName(table as never), values });

        return {
          returning: async () => await Promise.resolve([{ id: 500 }]),
        };
      },
    }),
  } as unknown as ContentDatabase;

  return { deletes, inserts, tx };
};

const model = createContentRevisionsModel({
  c: { get: () => undefined } as unknown as Context,
  definition: testEditorialPostContentType,
  pluginId: PLUGIN_ID,
});

const capture = async (
  fileIds: number[] | undefined,
  version = 1,
): Promise<ReturnType<typeof makeTx>> => {
  const harness = makeTx();

  await model.capture(harness.tx, {
    actor: { type: "staff", userId: 1 },
    changedFields: ["cover"],
    ...(fileIds === undefined ? {} : { fileIds }),
    itemId: 7,
    operation: "update",
    snapshot: {} as never,
    version,
  });

  return harness;
};

const pins = (harness: ReturnType<typeof makeTx>) =>
  harness.inserts.filter(
    entry => entry.table === getTableName(core_content_file_refs),
  );

describe("core_content_file_refs", () => {
  const config = getTableConfig(core_content_file_refs);
  const foreignKeys = config.foreignKeys.map(fk => {
    const reference = fk.reference();

    return {
      column: reference.columns[0]?.name,
      onDelete: fk.onDelete,
      table: getTableName(reference.foreignTable),
    };
  });

  /**
   * The pin's whole job. `RESTRICT` towards the file is what refuses the
   * deletion; `CASCADE` from the revision is what releases it again when
   * retention prunes the revision - with no code in between.
   */
  it("refuses a file deletion and releases it when the revision goes", () => {
    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        {
          column: "fileId",
          onDelete: "restrict",
          table: getTableName(core_files),
        },
        {
          column: "revisionId",
          onDelete: "cascade",
          table: getTableName(core_content_revisions),
        },
      ]),
    );
  });

  it("holds one pin per (revision, file) pair", () => {
    expect(config.indexes.map(item => item.config.name)).toContain(
      "core_content_file_refs_unique",
    );
    expect(
      config.indexes.find(
        item => item.config.name === "core_content_file_refs_unique",
      )?.config.unique,
    ).toBe(true);
  });

  it("indexes the file side, which RESTRICT scans on every delete", () => {
    expect(config.indexes.map(item => item.config.name)).toContain(
      "core_content_file_refs_file_id_idx",
    );
  });

  it("copies nothing from the file", () => {
    expect(config.columns.map(item => item.name).sort()).toEqual([
      "createdAt",
      "fileId",
      "id",
      "revisionId",
    ]);
  });
});

describe("revision capture", () => {
  it("pins every file the snapshot names, to the revision it just wrote", async () => {
    const harness = await capture([1, 2]);

    expect(pins(harness)[0].values).toEqual([
      { fileId: 1, revisionId: 500 },
      { fileId: 2, revisionId: 500 },
    ]);
  });

  it("writes one statement, not one per file", async () => {
    expect(pins(await capture([1, 2, 3]))).toHaveLength(1);
  });

  it("deduplicates, so the unique index is never the thing that fails", async () => {
    expect(pins(await capture([1, 1, 2]))[0].values).toEqual([
      { fileId: 1, revisionId: 500 },
      { fileId: 2, revisionId: 500 },
    ]);
  });

  it("writes nothing for a revision that names no file", async () => {
    expect(pins(await capture([]))).toHaveLength(0);
    expect(pins(await capture(undefined))).toHaveLength(0);
  });

  /**
   * Ordering, stated as a test: the pins go in before the retention prune, so
   * there is no window in which the new revision exists unpinned - and the prune
   * is what releases the *old* pins, through the cascade.
   */
  it("pins before it prunes", async () => {
    const harness = await capture(
      [1],
      testEditorialPostContentType.editorial.revisions.retention + 5,
    );

    expect(pins(harness)).toHaveLength(1);
    expect(harness.deletes).toEqual([getTableName(core_content_revisions)]);
    // Nothing deletes pins directly - the cascade does it.
    expect(harness.deletes).not.toContain(getTableName(core_content_file_refs));
  });

  it("prunes nothing while the record is inside the retention window", async () => {
    const harness = await capture([1], 2);

    expect(harness.deletes).toEqual([]);
  });
});

describe("the pinning lifecycle", () => {
  /**
   * The scenario the mechanism exists for, spelled out against the two facts
   * that implement it:
   *
   *   article -> file A, revision v1 pins A
   *   article -> file B, revision v2 pins B; the column no longer guards A
   *   deleting A is refused          <- the v1 pin, ON DELETE RESTRICT
   *   v1 is pruned by retention      <- the pin cascades away
   *   deleting A now succeeds        <- nothing references it
   */
  it("keeps the previous file pinned after the field moves on", async () => {
    const first = await capture([1], 1);
    const second = await capture([2], 2);

    // v1 still names file 1 even though the row now points at file 2.
    expect(pins(first)[0].values).toEqual([{ fileId: 1, revisionId: 500 }]);
    expect(pins(second)[0].values).toEqual([{ fileId: 2, revisionId: 500 }]);
    // And neither capture deleted a pin - only a pruned revision can.
    expect(first.deletes).not.toContain(getTableName(core_content_file_refs));
    expect(second.deletes).not.toContain(getTableName(core_content_file_refs));
  });
});

describe("the ids a snapshot yields", () => {
  /**
   * The composition the editorial service relies on: it builds the snapshot,
   * reads the file ids straight back out of it, and hands both to `capture`. So
   * the pins can only ever name files the snapshot actually recorded.
   */
  it("comes from the snapshot itself, not from the request payload", () => {
    const row = {
      animation: 2,
      cover: 1,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      document: null,
      id: 7,
      slug: "hello",
      status: "draft",
      title: "Hello",
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      version: 3,
    };

    const snapshot = contentRevisionSnapshot(testFilePostContentType, row);

    expect(snapshot.fields).toMatchObject({ animation: 2, cover: 1 });
    expect(contentSnapshotFileIds(testFilePostContentType, snapshot)).toEqual([
      1, 2,
    ]);
  });

  it("yields nothing for a record whose file fields are empty", () => {
    const snapshot = contentRevisionSnapshot(testFilePostContentType, {
      animation: null,
      cover: null,
      createdAt: new Date(0),
      document: null,
      id: 7,
      slug: "hello",
      status: "draft",
      title: "Hello",
      updatedAt: new Date(0),
      version: 1,
    });

    expect(contentSnapshotFileIds(testFilePostContentType, snapshot)).toEqual(
      [],
    );
  });
});
