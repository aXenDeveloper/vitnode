import type { Context } from "hono";

import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  core_content_file_refs,
  core_content_revisions,
} from "@/database/content";
import {
  testEditorialPostContentType,
  testFilePostContentType,
} from "@/tests/content-fixtures";

import type { ContentDatabase } from "./service";

import { contentSnapshotFileIds } from "./files";
import { contentRevisionSnapshot } from "./revision-snapshot";
import { createContentRevisionsModel } from "./revisions-model";

const PLUGIN_ID = "@vitnode/example";

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
});
