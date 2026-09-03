// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentDatabase } from "./service";

import {
  CONTENT_PREVIEW_SECRET_NAME,
  ensureContentPreviewSecret,
  resetContentPreviewSecret,
} from "./preview-secret";

const fakeDb = ({ rows = new Map<string, string>() } = {}) => {
  const selects = vi.fn();
  const inserts = vi.fn();

  const db = {
    insert: () => ({
      values: ({ name, value }: { name: string; value: string }) => {
        inserts(name, value);
        const conflict = rows.has(name);
        if (!conflict) rows.set(name, value);

        return {
          onConflictDoNothing: () => ({
            returning: async () => Promise.resolve(conflict ? [] : [{ value }]),
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            selects();
            const value = rows.get(CONTENT_PREVIEW_SECRET_NAME);

            return Promise.resolve(value === undefined ? [] : [{ value }]);
          },
        }),
      }),
    }),
  } as unknown as ContentDatabase;

  return { db, inserts, rows, selects };
};

beforeEach(() => {
  resetContentPreviewSecret();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetContentPreviewSecret();
});

describe("ensureContentPreviewSecret", () => {
  it("generates a signing key when nothing is configured", async () => {
    // The whole point: an install configures nothing and still gets a key
    // strong enough to sign links with.
    const { db, rows } = fakeDb();

    const secret = await ensureContentPreviewSecret(db);

    expect(Buffer.from(secret, "utf8").length).toBeGreaterThanOrEqual(32);
    expect(rows.get(CONTENT_PREVIEW_SECRET_NAME)).toBe(secret);
  });

  it("reuses the stored key rather than minting a second one", async () => {
    const rows = new Map([[CONTENT_PREVIEW_SECRET_NAME, "already-generated"]]);
    const { db, inserts } = fakeDb({ rows });

    expect(await ensureContentPreviewSecret(db)).toBe("already-generated");
    expect(inserts).not.toHaveBeenCalled();
  });

  it("lands on the winner's value when two processes race", async () => {
    // Both find the row missing, both insert, one loses. A loser that kept its
    // own value would sign links the winner cannot verify.
    const { db, rows } = fakeDb();
    const other = fakeDb({ rows });

    const first = await ensureContentPreviewSecret(db);
    resetContentPreviewSecret();
    rows.set(CONTENT_PREVIEW_SECRET_NAME, first);
    const second = await ensureContentPreviewSecret(other.db);

    expect(second).toBe(first);
  });

  it("reads the database once per process", async () => {
    const { db, selects } = fakeDb();

    await ensureContentPreviewSecret(db);
    await ensureContentPreviewSecret(db);
    await ensureContentPreviewSecret(db);

    expect(selects).toHaveBeenCalledTimes(1);
  });

  it("retries after a failure instead of poisoning the process", async () => {
    const failing = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => Promise.reject(new Error("database is down")),
          }),
        }),
      }),
    } as unknown as ContentDatabase;

    await expect(ensureContentPreviewSecret(failing)).rejects.toThrow(
      "database is down",
    );

    const { db } = fakeDb();
    await expect(ensureContentPreviewSecret(db)).resolves.toBeTypeOf("string");
  });
});
