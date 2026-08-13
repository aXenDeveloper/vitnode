// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentDatabase } from "./service";

import {
  CONTENT_PREVIEW_SECRET_NAME,
  ensureContentPreviewSecret,
  resetContentPreviewSecret,
} from "./preview-secret";

/**
 * A `core_secrets` table that behaves like the real one for the two operations
 * the resolver performs, including the part that matters: `onConflictDoNothing`
 * returns nothing when a row is already there.
 */
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
  vi.stubEnv("CONTENT_PREVIEW_SECRET", "");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetContentPreviewSecret();
});

describe("ensureContentPreviewSecret", () => {
  it("generates a signing key when nothing is configured", async () => {
    // The whole point: an install that set no environment variable still gets a
    // key strong enough to sign links with.
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

  describe("the CONTENT_PREVIEW_SECRET override", () => {
    it("wins over the generated key when it is usable", async () => {
      // Still the way to rotate every outstanding link at once, and the way two
      // deployments that share no database share a key.
      const override = "an-override-long-enough-to-be-a-signing-key";
      vi.stubEnv("CONTENT_PREVIEW_SECRET", override);
      const { db, selects } = fakeDb();

      expect(await ensureContentPreviewSecret(db)).toBe(override);
      // Never even asked: the override answers the question on its own.
      expect(selects).not.toHaveBeenCalled();
    });

    it("is ignored, loudly, when it is too short to sign with", async () => {
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      vi.stubEnv("CONTENT_PREVIEW_SECRET", "hunter2");
      const { db } = fakeDb();

      const secret = await ensureContentPreviewSecret(db);

      expect(secret).not.toBe("hunter2");
      expect(Buffer.from(secret, "utf8").length).toBeGreaterThanOrEqual(32);
      // Silently substituting a different key would make a rotation that did
      // not happen look like one that did.
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("CONTENT_PREVIEW_SECRET"),
      );
    });
  });
});
