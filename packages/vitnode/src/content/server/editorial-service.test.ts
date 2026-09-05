// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import {
  testCategoryContentType,
  testEditorialNoteContentType,
  testEditorialPostContentType,
} from "@/tests/content-fixtures";

import type { ContentRevisionSnapshot } from "../revisions";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentEditorialService } from "./editorial-service";
import type { ContentModel } from "./model";

import {
  ContentRevisionNotRestorable,
  ContentVersionConflict,
} from "../errors";
import { createContentModel } from "./model";

const categories = createContentModel(testCategoryContentType);
const posts = createContentModel(testEditorialPostContentType);
const notes = createContentModel(testEditorialNoteContentType);

const STAFF = { type: "staff", userId: 7 } as const;
const SYSTEM = { type: "system", userId: null } as const;

interface RecordedCall {
  arg: unknown;
  op: string;
}

const createDbMock = (
  results: unknown[][],
  { failAt }: { failAt?: number } = {},
) => {
  const calls: RecordedCall[] = [];
  const queue = [...results];
  let started = 0;
  let rolledBack = false;

  const chain = (rows: unknown[]) => {
    const record = (op: string, arg: unknown) => {
      calls.push({ arg, op });

      return builder;
    };

    const builder = {
      $dynamic: () => builder,
      from: (value: unknown) => record("from", value),
      leftJoin: (value: unknown) => record("leftJoin", value),
      limit: (value: unknown) => record("limit", value),
      orderBy: (value: unknown) => record("orderBy", value),
      returning: (value: unknown) => record("returning", value),
      set: (value: unknown) => record("set", value),
      then: async <TResult>(resolve: (rows: unknown[]) => TResult) =>
        Promise.resolve(rows).then(resolve),
      values: (value: unknown) => record("values", value),
      where: (value: unknown) => record("where", value),
    };

    return builder;
  };

  const start = (op: string) => (arg: unknown) => {
    started += 1;
    calls.push({ arg, op });

    if (failAt !== undefined && started === failAt) {
      throw new Error("insert failed");
    }

    return chain(queue.shift() ?? []);
  };

  const db = {
    delete: start("delete"),
    insert: start("insert"),
    select: start("select"),
    transaction: async <TResult>(
      body: (tx: unknown) => Promise<TResult>,
    ): Promise<TResult> => {
      try {
        return await body(db);
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
    update: start("update"),
  };

  const c = {
    get: (key: string) => (key === "db" ? db : undefined),
  } as Context;

  return { c, calls, didRollBack: () => rolledBack };
};

const opsOf = (calls: RecordedCall[], op: string) =>
  calls.filter(call => call.op === op).map(call => call.arg);

const columnsIn = (condition: unknown): string[] => {
  const walk = (value: unknown): unknown[] =>
    value !== null && typeof value === "object" && "queryChunks" in value
      ? (value.queryChunks as unknown[]).flatMap(walk)
      : [value];

  return walk(condition)
    .map(chunk => (chunk as null | { name?: unknown })?.name)
    .filter((name): name is string => typeof name === "string");
};

const editorialServiceOf = <TDefinition extends AnyContentTypeDefinition>(
  model: ContentModel<TDefinition>,
  c: Context,
): ContentEditorialService<TDefinition> => {
  const build = model.editorialService;
  if (!build)
    throw new Error(`${model.definition.id} has no editorial service`);

  return build(c, { pluginId: "@vitnode/test" });
};

const service = (c: Context) => editorialServiceOf(posts, c);

const noteService = (c: Context) => editorialServiceOf(notes, c);

const row = (overrides: Record<string, unknown> = {}) => ({
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  excerpt: null,
  id: 1,
  publishedAt: null,
  slug: "hello",
  status: "draft",
  title: "Hello",
  updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  version: 1,
  views: 0,
  ...overrides,
});

const snapshot = (
  fields: Record<string, unknown>,
  version = 1,
): ContentRevisionSnapshot =>
  ({
    contentTypeId: "test.editorial",
    createdAt: "2024-01-01T00:00:00.000Z",
    fields,
    id: 1,
    publication: { publishedAt: null, status: "draft" },
    schemaVersion: 1,
    updatedAt: "2024-01-02T00:00:00.000Z",
    version,
  }) as ContentRevisionSnapshot;

describe("editorial service", () => {
  it("is undefined for a content type without the workflow", () => {
    expect(categories.editorialService).toBeUndefined();
    expect(posts.editorialService).toBeDefined();
  });

  describe("create", () => {
    it("starts at version 1 and captures a create revision", async () => {
      const { c, calls } = createDbMock([[row({ version: 1 })], [{ id: 10 }]]);

      const result = await service(c).create(
        { title: "Hello" },
        { actor: STAFF },
      );

      expect(result.changed).toBe(true);
      expect(result.version).toBe(1);
      expect(result.revisionId).toBe(10);
      expect(result.operation).toBe("create");

      const revision = opsOf(calls, "values")[1] as Record<string, unknown>;
      expect(revision.version).toBe(1);
      expect(revision.operation).toBe("create");
      expect(revision.actorType).toBe("staff");
      expect(revision.actorUserId).toBe(7);
      expect(revision.contentTypeId).toBe("test.editorial");
      expect(revision.pluginId).toBe("@vitnode/test");
    });

    it("records a system actor without inventing a user id", async () => {
      const { c, calls } = createDbMock([[row()], [{ id: 10 }]]);

      await service(c).create({ title: "Hello" }, { actor: SYSTEM });

      const revision = opsOf(calls, "values")[1] as Record<string, unknown>;
      expect(revision.actorType).toBe("system");
      expect(revision.actorUserId).toBeNull();
    });
  });

  describe("update", () => {
    it("increments the version and captures one revision", async () => {
      const { c, calls } = createDbMock([
        [row({ version: 4 })],
        [row({ title: "Changed", version: 5 })],
        [{ id: 11 }],
      ]);

      const result = await service(c).update(
        1,
        { title: "Changed" },
        { actor: STAFF, expectedVersion: 4 },
      );

      expect(result?.changed).toBe(true);
      expect(result?.version).toBe(5);
      expect(result?.changedFields).toEqual(["title"]);
      // Exactly one revision insert, and exactly one content update.
      expect(opsOf(calls, "update")).toHaveLength(1);
      expect(opsOf(calls, "insert")).toHaveLength(1);
    });

    it("guards the write on the expected version", async () => {
      const { c, calls } = createDbMock([
        [row({ version: 4 })],
        [row({ title: "Changed", version: 5 })],
        [{ id: 11 }],
      ]);

      await service(c).update(
        1,
        { title: "Changed" },
        { actor: STAFF, expectedVersion: 4 },
      );

      // `version = version + 1` travels with the same statement that checks it,
      // which is what makes check-and-set atomic.
      const set = opsOf(calls, "set")[0] as Record<string, unknown>;
      expect(set.version).toBeDefined();
      expect(set.title).toBe("Changed");
    });

    it("reports a conflict when the version moved", async () => {
      const { c } = createDbMock([
        [row({ version: 4 })],
        // The guarded UPDATE matches nothing...
        [],
        // ...and the record is still there, at a newer version.
        [{ version: 9 }],
      ]);

      await expect(
        service(c).update(
          1,
          { title: "Changed" },
          { actor: STAFF, expectedVersion: 4 },
        ),
      ).rejects.toThrow(ContentVersionConflict);
    });

    it("carries both versions on the conflict", async () => {
      const { c } = createDbMock([[row({ version: 4 })], [], [{ version: 9 }]]);

      const error = await service(c)
        .update(1, { title: "Changed" }, { actor: STAFF, expectedVersion: 4 })
        .catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(ContentVersionConflict);
      const conflict = error as ContentVersionConflict;
      expect(conflict.expectedVersion).toBe(4);
      expect(conflict.currentVersion).toBe(9);
      expect(conflict.itemId).toBe(1);
    });

    it("returns null for a record that does not exist", async () => {
      const { c } = createDbMock([[]]);

      await expect(
        service(c).update(
          99,
          { title: "Changed" },
          { actor: STAFF, expectedVersion: 1 },
        ),
      ).resolves.toBeNull();
    });

    it("writes nothing at all when the diff is empty", async () => {
      const { c, calls } = createDbMock([
        [row({ title: "Hello", version: 4 })],
      ]);

      const result = await service(c).update(
        1,
        { title: "Hello" },
        { actor: STAFF, expectedVersion: 4 },
      );

      expect(result?.changed).toBe(false);
      expect(result?.version).toBe(4);
      expect(result?.revisionId).toBeNull();
      expect(opsOf(calls, "update")).toHaveLength(0);
      expect(opsOf(calls, "insert")).toHaveLength(0);
    });

    it("rolls back the content write when the revision insert fails", async () => {
      // 1 select, 2 update, 3 insert <- fails
      const { c, didRollBack } = createDbMock(
        [[row({ version: 4 })], [row({ title: "Changed", version: 5 })]],
        { failAt: 3 },
      );

      await expect(
        service(c).update(
          1,
          { title: "Changed" },
          { actor: STAFF, expectedVersion: 4 },
        ),
      ).rejects.toThrow("insert failed");

      expect(didRollBack()).toBe(true);
    });
  });

  describe("publish and unpublish", () => {
    it("increments the version on a real transition", async () => {
      const { c, calls } = createDbMock([
        [row({ publishedAt: new Date(), status: "published", version: 3 })],
        [{ id: 12 }],
      ]);

      const result = await service(c).publish(1, { actor: STAFF });

      expect(result?.changed).toBe(true);
      expect(result?.version).toBe(3);
      expect(
        (opsOf(calls, "values")[0] as Record<string, unknown>).operation,
      ).toBe("publish");
    });

    it("leaves the version alone and writes no revision when idempotent", async () => {
      const { c, calls } = createDbMock([
        // The guarded UPDATE matches nothing - already published.
        [],
        [row({ status: "published", version: 3 })],
      ]);

      const result = await service(c).publish(1, { actor: STAFF });

      expect(result?.changed).toBe(false);
      expect(result?.version).toBe(3);
      expect(result?.revisionId).toBeNull();
      expect(opsOf(calls, "insert")).toHaveLength(0);
    });

    it("returns null when the record is gone", async () => {
      const { c } = createDbMock([[], []]);

      await expect(service(c).publish(1, { actor: STAFF })).resolves.toBeNull();
    });

    it("enforces an expected version when one is supplied", async () => {
      const { c } = createDbMock([[], [row({ status: "draft", version: 9 })]]);

      await expect(
        service(c).publish(1, { actor: STAFF, expectedVersion: 4 }),
      ).rejects.toThrow(ContentVersionConflict);
    });

    it("unpublishes without touching publishedAt", async () => {
      const { c, calls } = createDbMock([
        [row({ publishedAt: new Date(), status: "draft", version: 4 })],
        [{ id: 13 }],
      ]);

      await service(c).unpublish(1, { actor: STAFF });

      const set = opsOf(calls, "set")[0] as Record<string, unknown>;
      expect(set.status).toBe("draft");
      expect(set).not.toHaveProperty("publishedAt");
    });
  });

  describe("delete", () => {
    it("captures a final revision one version past the last", async () => {
      const { c, calls } = createDbMock([[row({ version: 6 })], [{ id: 14 }]]);

      const result = await service(c).delete(1, {
        actor: STAFF,
        expectedVersion: 6,
      });

      expect(result?.operation).toBe("delete");
      // The row is gone, so nothing holds version 7 - but the history stays
      // strictly increasing and the unique index stays meaningful.
      expect(result?.version).toBe(7);
      expect(
        (opsOf(calls, "values")[0] as Record<string, unknown>).version,
      ).toBe(7);
    });

    it("guards the DELETE on the version it was given", async () => {
      // The precondition has to be part of the statement that removes the row.
      // Reading the version first and deleting second is the very race this
      // exists to close.
      const { c, calls } = createDbMock([[row({ version: 6 })], [{ id: 14 }]]);

      await service(c).delete(1, { actor: STAFF, expectedVersion: 6 });

      expect(columnsIn(opsOf(calls, "where")[0])).toEqual(
        expect.arrayContaining(["id", "version"]),
      );
    });

    it("returns null when there was nothing to delete", async () => {
      // Nothing deleted and nothing there: the caller wanted it gone, and it
      // is. A 404, never a conflict.
      const { c } = createDbMock([[], []]);

      await expect(
        service(c).delete(1, { actor: STAFF, expectedVersion: 6 }),
      ).resolves.toBeNull();
    });

    it("refuses to delete a version the caller has not seen", async () => {
      // Nothing deleted, but the record is still there at a newer version -
      // somebody saved after this table was rendered.
      const { c } = createDbMock([[], [{ version: 9 }]]);

      await expect(
        service(c).delete(1, { actor: STAFF, expectedVersion: 6 }),
      ).rejects.toMatchObject({
        currentVersion: 9,
        expectedVersion: 6,
        name: "ContentVersionConflict",
      });
    });

    it("writes no revision when the delete is refused", async () => {
      const { c, calls } = createDbMock([[], [{ version: 9 }]]);

      await expect(
        service(c).delete(1, { actor: STAFF, expectedVersion: 6 }),
      ).rejects.toThrow();

      expect(opsOf(calls, "values")).toHaveLength(0);
    });
  });

  describe("retention", () => {
    it("prunes past the window in the same transaction", async () => {
      // Retention is 10 on this fixture, so a write at version 12 drops
      // everything at or below version 2.
      const { c, calls } = createDbMock([
        [row({ version: 11 })],
        [row({ title: "Changed", version: 12 })],
        [{ id: 15 }],
        [],
      ]);

      await service(c).update(
        1,
        { title: "Changed" },
        { actor: STAFF, expectedVersion: 11 },
      );

      expect(opsOf(calls, "delete")).toHaveLength(1);
    });

    it("does not prune while the history is inside the window", async () => {
      const { c, calls } = createDbMock([
        [row({ version: 2 })],
        [row({ title: "Changed", version: 3 })],
        [{ id: 15 }],
      ]);

      await service(c).update(
        1,
        { title: "Changed" },
        { actor: STAFF, expectedVersion: 2 },
      );

      expect(opsOf(calls, "delete")).toHaveLength(0);
    });
  });

  describe("restore", () => {
    const restoreMock = (
      current: Record<string, unknown>,
      revisionSnapshot: ContentRevisionSnapshot,
      rest: unknown[][] = [],
    ) =>
      createDbMock([
        // findById
        [{ id: 3, snapshot: revisionSnapshot, version: 2 }],
        // readOne
        [current],
        ...rest,
      ]);

    it("applies the snapshot's fields and creates a new version", async () => {
      const { c, calls } = restoreMock(
        row({ title: "Now", version: 8 }),
        snapshot({ excerpt: null, slug: "hello", title: "Then", views: 0 }),
        [[row({ title: "Then", version: 9 })], [{ id: 16 }]],
      );

      const result = await service(c).restore(1, 3, {
        actor: STAFF,
        expectedVersion: 8,
      });

      expect(result?.changed).toBe(true);
      expect(result?.version).toBe(9);
      expect(result?.changedFields).toEqual(["title"]);

      const revision = opsOf(calls, "values")[0] as Record<string, unknown>;
      expect(revision.operation).toBe("restore");
      expect(revision.restoredFromRevisionId).toBe(3);
      // The restored revision's own version is never reinstated.
      expect(revision.version).toBe(9);
    });

    it("never writes the publication columns", async () => {
      const { c, calls } = restoreMock(
        row({ status: "published", title: "Now", version: 8 }),
        snapshot({ excerpt: null, slug: "hello", title: "Then", views: 0 }),
        [[row({ title: "Then", version: 9 })], [{ id: 16 }]],
      );

      await service(c).restore(1, 3, { actor: STAFF, expectedVersion: 8 });

      const set = opsOf(calls, "set")[0] as Record<string, unknown>;
      expect(set).not.toHaveProperty("status");
      expect(set).not.toHaveProperty("publishedAt");
    });

    it("ignores a field the content type no longer declares", async () => {
      const { c, calls } = restoreMock(
        row({ title: "Now", version: 8 }),
        snapshot({
          excerpt: null,
          removedField: "gone",
          slug: "hello",
          title: "Then",
          views: 0,
        }),
        [[row({ title: "Then", version: 9 })], [{ id: 16 }]],
      );

      await service(c).restore(1, 3, { actor: STAFF, expectedVersion: 8 });

      const set = opsOf(calls, "set")[0] as Record<string, unknown>;
      expect(set).not.toHaveProperty("removedField");
    });

    it("refuses a snapshot that is invalid under the current rules", async () => {
      const { c } = restoreMock(
        row({ title: "Now", version: 8 }),
        // `title` has minLength 3 on this fixture.
        snapshot({ excerpt: null, slug: "hello", title: "no", views: 0 }),
      );

      await expect(
        service(c).restore(1, 3, { actor: STAFF, expectedVersion: 8 }),
      ).rejects.toThrow(ContentRevisionNotRestorable);
    });

    it("names only field names when it refuses", async () => {
      const { c } = restoreMock(
        row({ title: "Now", version: 8 }),
        snapshot({ excerpt: null, slug: "hello", title: "no", views: 0 }),
      );

      const error = await service(c)
        .restore(1, 3, { actor: STAFF, expectedVersion: 8 })
        .catch((thrown: unknown) => thrown);

      expect((error as ContentRevisionNotRestorable).fields).toEqual(["title"]);
    });

    it("writes nothing when the snapshot matches the record", async () => {
      const { c, calls } = restoreMock(
        row({ title: "Same", version: 8 }),
        snapshot({ excerpt: null, slug: "hello", title: "Same", views: 0 }),
      );

      const result = await service(c).restore(1, 3, {
        actor: STAFF,
        expectedVersion: 8,
      });

      expect(result?.changed).toBe(false);
      expect(result?.revisionId).toBeNull();
      expect(opsOf(calls, "update")).toHaveLength(0);
    });

    it("reports a conflict when the version moved", async () => {
      const { c } = restoreMock(
        row({ title: "Now", version: 8 }),
        snapshot({ excerpt: null, slug: "hello", title: "Then", views: 0 }),
        [[], [{ version: 12 }]],
      );

      await expect(
        service(c).restore(1, 3, { actor: STAFF, expectedVersion: 8 }),
      ).rejects.toThrow(ContentVersionConflict);
    });

    it("returns null for a revision that is not this record's", async () => {
      const { c } = createDbMock([[]]);

      await expect(
        service(c).restore(1, 3, { actor: STAFF, expectedVersion: 8 }),
      ).resolves.toBeNull();
    });
  });

  describe("without publication", () => {
    it("still versions and captures revisions", async () => {
      const { c, calls } = createDbMock([
        [{ body: null, id: 1, title: "Note", version: 1 }],
        [{ id: 20 }],
      ]);

      const result = await noteService(c).create(
        { title: "Note" },
        { actor: STAFF },
      );

      expect(result.version).toBe(1);
      const revision = opsOf(calls, "values")[1] as Record<string, unknown>;
      // No publication block on the snapshot - there is no lifecycle to record.
      expect(
        (revision.snapshot as ContentRevisionSnapshot).publication,
      ).toBeUndefined();
    });
  });
});
