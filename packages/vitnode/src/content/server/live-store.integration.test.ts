// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import type { ContentLiveRoomRef } from "@/content/live/protocol";

import {
  core_content_drafts,
  core_content_field_locks,
} from "@/database/content-drafts";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import {
  createTestDatabase,
  describePostgres,
  type TestDatabaseHandle,
} from "@/tests/postgres";

import {
  acquireContentFieldLock,
  findContentFieldLock,
  heldContentFieldLocks,
  readContentDrafts,
  writeContentDraft,
} from "./live-store";

const room: ContentLiveRoomRef = { contentTypeId: "test.guide", itemId: 1 };
const title = { ...room, field: "title", locale: "en" };

describePostgres("the field lock and draft store", () => {
  let database: TestDatabaseHandle;
  let anna: number;
  let marek: number;

  beforeAll(async () => {
    database = await createTestDatabase({
      core_content_drafts,
      core_content_field_locks,
      core_files,
      core_languages,
      core_roles,
      core_users,
    });

    await database.db
      .insert(core_languages)
      .values({ code: "en", name: "English", timezone: "UTC" });
    await database.db.insert(core_roles).values({ id: 1 });
    const users = await database.db
      .insert(core_users)
      .values(
        ["anna", "marek"].map(name => ({
          avatarColor: "000000",
          email: `${name}@example.com`,
          ipAddress: "127.0.0.1",
          name,
          nameCode: name,
          roleId: 1,
        })),
      )
      .returning({ id: core_users.id });
    [anna, marek] = users.map(user => user.id);
  });

  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    await database.db.delete(core_content_field_locks);
    await database.db.delete(core_content_drafts);
  });

  it("lets exactly one of two racing editors take a free field", async () => {
    const results = await Promise.all([
      acquireContentFieldLock(database.connect(), title, anna),
      acquireContentFieldLock(database.connect(), title, marek),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("refuses a held lease, and hands over an expired one", async () => {
    const start = new Date("2026-10-08T10:00:00Z");

    expect(await acquireContentFieldLock(database.db, title, anna, start)).toBe(
      true,
    );
    expect(
      await acquireContentFieldLock(database.db, title, marek, start),
    ).toBe(false);
    // The holder re-acquiring is a renewal, not a conflict.
    expect(await acquireContentFieldLock(database.db, title, anna, start)).toBe(
      true,
    );

    const later = new Date(start.getTime() + 61_000);

    expect(
      await acquireContentFieldLock(database.db, title, marek, later),
    ).toBe(true);
    expect(
      (await findContentFieldLock(database.db, title, later))?.user.id,
    ).toBe(marek);
  });

  it("only counts the caller's unexpired locks in that language", async () => {
    await acquireContentFieldLock(database.db, title, anna);
    await acquireContentFieldLock(
      database.db,
      { ...title, field: "excerpt" },
      marek,
    );

    const held = await heldContentFieldLocks(database.db, {
      locale: "en",
      names: ["title", "excerpt"],
      room,
      userId: anna,
    });

    expect([...held]).toEqual(["title"]);
  });

  it("merges concurrent draft writes of different fields", async () => {
    await Promise.all([
      writeContentDraft(database.connect(), {
        baseVersion: 3,
        locale: "en",
        room,
        userId: anna,
        values: { title: "Hello" },
      }),
      writeContentDraft(database.connect(), {
        baseVersion: 3,
        locale: "en",
        room,
        userId: marek,
        values: { excerpt: "Short" },
      }),
    ]);
    await writeContentDraft(database.db, {
      baseVersion: 3,
      locale: null,
      room,
      userId: anna,
      values: { categoryId: [1, 2] },
    });

    const drafts = await readContentDrafts(database.db, room);

    expect(drafts.translations.en.values).toEqual({
      excerpt: "Short",
      title: "Hello",
    });
    expect(drafts.shared?.values).toEqual({ categoryId: [1, 2] });
  });

  it("overwrites a field's earlier draft value", async () => {
    const write = async (value: string) =>
      await writeContentDraft(database.db, {
        baseVersion: 1,
        locale: "en",
        room,
        userId: anna,
        values: { title: value },
      });

    await write("First");
    await write("Second");

    expect(
      (await readContentDrafts(database.db, room)).translations.en,
    ).toMatchObject({ updatedBy: { id: anna }, values: { title: "Second" } });
  });
});
