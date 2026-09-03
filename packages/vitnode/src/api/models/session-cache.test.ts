// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { SessionUser } from "./session-cache";

import {
  adminSessionCacheKey,
  reviveSessionUser,
  SESSION_CACHE_TTL_SECONDS,
  sessionCacheKey,
  sessionCacheTtl,
} from "./session-cache";

const here = dirname(fileURLToPath(import.meta.url));

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);

describe("a cache key names exactly one identity", () => {
  it("changes with the token", () => {
    expect(sessionCacheKey(TOKEN_A, 1)).not.toBe(sessionCacheKey(TOKEN_B, 1));
  });

  it("changes with the device", () => {
    expect(sessionCacheKey(TOKEN_A, 1)).not.toBe(sessionCacheKey(TOKEN_A, 2));
  });

  it("carries both, so neither alone can address an entry", () => {
    expect(sessionCacheKey(TOKEN_A, 7)).toContain(TOKEN_A);
    expect(sessionCacheKey(TOKEN_A, 7)).toContain("7");
  });

  it("is stable for one identity", () => {
    // A key that varied per call would cache every request separately and read
    // none of them back - a silent miss rather than a failure.
    expect(sessionCacheKey(TOKEN_A, 1)).toBe(sessionCacheKey(TOKEN_A, 1));
  });

  it("cannot be confused between two device ids by concatenation", () => {
    // The near-miss this ordering avoids. With the token first and no separator
    // discipline, device `1` + token `23…` and device `12` + token `3…` would
    // spell the same key. The device sits in its own segment ahead of the token
    // for exactly that reason.
    expect(sessionCacheKey("23", 1)).not.toBe(sessionCacheKey("3", 12));
  });
});

describe("the public and admin session caches cannot collide", () => {
  it("keys the same session differently", () => {
    expect(adminSessionCacheKey(TOKEN_A, 1)).not.toBe(
      sessionCacheKey(TOKEN_A, 1),
    );
  });

  it("keeps neither key space a prefix of the other", () => {
    // Not merely "different": `deleteSystem` takes exact keys, but any future
    // pattern delete over one namespace must not be able to reach the other.
    const user = sessionCacheKey(TOKEN_A, 1);
    const admin = adminSessionCacheKey(TOKEN_A, 1);

    expect(user.startsWith(admin)).toBe(false);
    expect(admin.startsWith(user)).toBe(false);
  });

  it("shares the session: namespace so a revocation can name both", () => {
    // `revoke-device.route.ts` deletes both keys for one device in a single
    // call, which is only possible because they are built from the same inputs.
    expect(sessionCacheKey(TOKEN_A, 1).startsWith("session:")).toBe(true);
    expect(adminSessionCacheKey(TOKEN_A, 1).startsWith("session:")).toBe(true);
  });
});

describe("a cached user never outlives the session", () => {
  const inSeconds = (seconds: number): Date =>
    new Date(Date.now() + seconds * 1000);

  it("caps a long-lived session at the cache TTL", () => {
    // A 90-day cookie must not mean a 90-day cached permission snapshot. The
    // ceiling is what bounds how stale any session read can be.
    expect(sessionCacheTtl(inSeconds(60 * 60 * 24 * 90))).toBe(
      SESSION_CACHE_TTL_SECONDS,
    );
  });

  it("caps a short-lived session at its own expiry", () => {
    expect(sessionCacheTtl(inSeconds(10))).toBeLessThanOrEqual(10);
    expect(sessionCacheTtl(inSeconds(10))).toBeGreaterThan(0);
  });

  it("never exceeds the ceiling, whatever the expiry", () => {
    for (const seconds of [1, 30, 59, 60, 61, 3600, 86_400]) {
      expect(sessionCacheTtl(inSeconds(seconds))).toBeLessThanOrEqual(
        SESSION_CACHE_TTL_SECONDS,
      );
    }
  });

  it("returns nothing cacheable for a session that has already expired", () => {
    // The value the call sites test against. Anything above zero here would
    // cache a dead session.
    expect(sessionCacheTtl(inSeconds(-1))).toBeLessThanOrEqual(0);
    expect(sessionCacheTtl(new Date(Date.now() - 60_000))).toBeLessThanOrEqual(
      0,
    );
  });
});

describe("both session models refuse to write a non-positive TTL", () => {
  it.each(["session.ts", "session-admin.ts"])("%s guards the write", file => {
    const source = readFileSync(join(here, file), "utf8");

    expect(source).toMatch(
      /const ttl = sessionCacheTtl\([^)]*\);\s*if \(ttl > 0\) await cache\.setSystem\(/,
    );
  });
});

describe("a user read back from the cache is the user that was written", () => {
  const user = {
    avatarColor: "#123456",
    birthday: new Date("1990-05-04T00:00:00.000Z"),
    createdAt: new Date("2024-01-02T03:04:05.000Z"),
    email: "test@test.com",
    emailVerified: true,
    id: 7,
    language: "en",
    name: "Test",
    nameCode: "test",
    newsletter: false,
    roleId: 2,
  } as unknown as SessionUser;

  /** What Redis actually hands back: JSON, so every `Date` is a string. */
  const roundTrip = (value: SessionUser): SessionUser =>
    JSON.parse(JSON.stringify(value)) as SessionUser;

  it("restores the dates JSON flattened into strings", () => {
    const revived = reviveSessionUser(roundTrip(user));

    expect(revived.createdAt).toBeInstanceOf(Date);
    expect(revived.createdAt.getTime()).toBe(user.createdAt.getTime());
  });

  it("keeps a null birthday null rather than turning it into an epoch date", () => {
    // `new Date(null)` is 1970-01-01, which would render as a birthday nobody
    // entered. The nullish branch is the whole reason this helper exists.
    const revived = reviveSessionUser(roundTrip({ ...user, birthday: null }));

    expect(revived.birthday).toBeNull();
  });

  it("restores a birthday that is set", () => {
    const revived = reviveSessionUser(roundTrip(user));

    expect(revived.birthday).toBeInstanceOf(Date);
    expect(revived.birthday?.getTime()).toBe(user.birthday?.getTime());
  });

  it("changes nothing else", () => {
    const revived = reviveSessionUser(roundTrip(user));

    expect({ ...revived, birthday: null, createdAt: null }).toStrictEqual({
      ...user,
      birthday: null,
      createdAt: null,
    });
  });
});
