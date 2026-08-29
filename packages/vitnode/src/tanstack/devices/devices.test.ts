import { hashKey, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as DevicesRevokeModule from "@/views/auth/settings/devices/devices-revoke";
import type { RevokeDeviceResult } from "@/views/auth/settings/devices/devices-revoke";

import { devicesQueryKey } from "@/views/auth/settings/devices/devices-query";

/**
 * `/settings/devices`' contract with the cache underneath it.
 *
 * Pure functions and one `QueryClient` held in memory. The *meaning* of a
 * devices request - the key, the request, what a refusal is, and whether a
 * finished revoke makes the list stale - lives in
 * `views/auth/settings/devices/devices-query.ts` and is asserted beside it. What
 * is asserted here is that this namespace asks for the right one, and that a
 * revoke invalidates exactly the one entry it should and nothing else.
 *
 * The revoke's transport is stubbed rather than reached. There is no HTTP here:
 * the only thing under test is which statuses cause an invalidation, which is
 * the decision that replaced `revalidatePath('/[locale]/(main)', 'layout')`.
 */

/** What the stubbed browser revoke answers with on the next call. */
let nextRevokeResult: RevokeDeviceResult = { data: true };

vi.mock(
  "@/views/auth/settings/devices/devices-revoke",
  async importOriginal => ({
    // Everything real except the one function that would open a socket - so
    // `shouldRefreshAfterRevoke`, the rule actually being exercised, is the
    // shared one and not a second copy of it written for this test.
    ...(await importOriginal<typeof DevicesRevokeModule>()),
    revokeDeviceInBrowser: async () => Promise.resolve(nextRevokeResult),
  }),
);

const { devicesQuery, invalidateDevices, revokeDevice } =
  await import("./index");

/** The visitor these tests are signed in as. */
const USER = 10;

/** Another visitor, whose partition must survive this one's revoke untouched. */
const OTHER_USER = 20;

/** The two entries a devices invalidation must tell apart. */
const SESSION_KEY = ["vitnode", "session"] as const;
const MESSAGES_KEY = ["intl", "en", "core.global"] as const;

const seed = () => {
  const queryClient = new QueryClient();

  queryClient.setQueryData(devicesQuery(USER).queryKey, { devices: [] });
  // A partition left behind by a visitor who signed out on this browser.
  queryClient.setQueryData(devicesQuery(OTHER_USER).queryKey, { devices: [] });
  queryClient.setQueryData(SESSION_KEY, { user: { id: USER } });
  queryClient.setQueryData(MESSAGES_KEY, { messages: {} });

  return queryClient;
};

const isStale = (queryClient: QueryClient, queryKey: readonly unknown[]) =>
  queryClient.getQueryState(queryKey)?.isInvalidated === true;

beforeEach(() => {
  nextRevokeResult = { data: true };
});

describe("this namespace asks for the shared devices list, not its own", () => {
  it("lands in the canonical entry", () => {
    // The loader and the component both call `devicesQuery()`, and it has to be
    // the entry the invalidation names or a revoke would refresh nothing.
    expect(hashKey(devicesQuery(USER).queryKey)).toBe(
      hashKey(devicesQueryKey(USER)),
    );
  });

  it("carries no locale, because the data is the same in every language", () => {
    // An OS name, a browser, an IP address and two timestamps do not change with
    // the language. A locale in the key would refetch on every language switch.
    expect(devicesQuery(USER).queryKey).toEqual(["devices", "user", USER]);
  });

  it("asks once, so a 429 is not answered by two more requests", () => {
    expect(devicesQuery(USER).retry).toBe(false);
  });

  /**
   * The privacy invariant at this namespace's own seam.
   *
   * The browser's `QueryClient` is created once per document and outlives a
   * sign-out, so `["devices", "me"]` was only unique for as long as "me" was:
   * the second visitor to sign in on one browser would have found the entry
   * already filled, made no request, and been shown the first visitor's
   * operating systems, browsers and IP addresses. No request means Hono never
   * saw the read it would have refused, which is why the key is the fix.
   */
  it("gives two visitors two entries, so one cannot read the other's", () => {
    expect(hashKey(devicesQuery(USER).queryKey)).not.toBe(
      hashKey(devicesQuery(OTHER_USER).queryKey),
    );
  });
});

describe("a revoke makes the devices list stale, and only that", () => {
  it("marks the list stale when a device actually went", async () => {
    const queryClient = seed();

    await invalidateDevices(queryClient, USER);

    expect(isStale(queryClient, devicesQueryKey(USER))).toBe(true);
  });

  it("leaves everything else in the cache alone", async () => {
    // Emphatically not `invalidateQueries()` with no key, and not
    // `router.invalidate()`: the session and the messages have not changed
    // because a phone was signed out. Refetching them would be the blunt version
    // of the `revalidatePath` this replaces.
    const queryClient = seed();

    await invalidateDevices(queryClient, USER);

    expect(isStale(queryClient, SESSION_KEY)).toBe(false);
    expect(isStale(queryClient, MESSAGES_KEY)).toBe(false);
  });

  it("keeps the rows on screen while the fresh ones are fetched", async () => {
    // Invalidating rather than removing, so the list is not blanked under a
    // dialog that is still closing.
    const queryClient = seed();

    await invalidateDevices(queryClient, USER);

    expect(queryClient.getQueryData(devicesQueryKey(USER))).toBeDefined();
  });

  it("leaves a previous visitor's partition untouched", async () => {
    // Prefix matching is the whole of it: one visitor's revoke names their own
    // entry and cannot refetch a list on behalf of somebody who signed out.
    const queryClient = seed();

    await revokeDevice(queryClient, USER, { publicId: "a1b2c3" });

    expect(isStale(queryClient, devicesQueryKey(OTHER_USER))).toBe(false);
  });

  it("does not invalidate the session, because the current device cannot be revoked", async () => {
    // The API answers 400 for the device the request itself comes from, so no
    // revoke reachable from this page can end the session performing it. There
    // is no state in which a successful revoke leaves the cached session falsely
    // authenticated - which is why this invalidation is one key rather than two.
    const queryClient = seed();

    await revokeDevice(queryClient, USER, { publicId: "a1b2c3" });

    expect(isStale(queryClient, SESSION_KEY)).toBe(false);
  });
});

describe("the revoke refreshes on exactly the statuses that changed something", () => {
  it("refreshes after a success", async () => {
    const queryClient = seed();
    nextRevokeResult = { data: true };

    await revokeDevice(queryClient, USER, { publicId: "a1b2c3" });

    expect(isStale(queryClient, devicesQueryKey(USER))).toBe(true);
  });

  it.each([404, 400])(
    "refreshes after a %i, because the row on screen was already wrong",
    async status => {
      const queryClient = seed();
      nextRevokeResult = { error: { status } };

      await revokeDevice(queryClient, USER, { publicId: "a1b2c3" });

      expect(isStale(queryClient, devicesQueryKey(USER))).toBe(true);
    },
  );

  it.each([401, 403, 429, 500])(
    "leaves the list alone after a %i, which deleted nothing",
    async status => {
      // The refetch would be a second request into whatever refused the first: a
      // rate limiter answered by immediately asking again, or an ended session
      // answered by a 401 that blanks the list being read.
      const queryClient = seed();
      nextRevokeResult = { error: { status } };

      await revokeDevice(queryClient, USER, { publicId: "a1b2c3" });

      expect(isStale(queryClient, devicesQueryKey(USER))).toBe(false);
    },
  );

  it("returns the finite result to the caller either way", async () => {
    const queryClient = seed();
    nextRevokeResult = { error: { status: 429 } };

    expect(
      await revokeDevice(queryClient, USER, { publicId: "a1b2c3" }),
    ).toEqual({
      error: { status: 429 },
    });
  });
});
