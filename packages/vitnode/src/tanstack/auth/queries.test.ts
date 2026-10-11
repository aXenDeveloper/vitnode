import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  DEVICES_IDENTITY_ROOT,
  devicesQueryKey,
} from "@/views/auth/settings/devices/devices-query";
import {
  PASSKEYS_IDENTITY_ROOT,
  passkeysQueryKey,
} from "@/views/auth/settings/passkeys/passkeys-query";
import {
  SSO_CONNECTIONS_IDENTITY_ROOT,
  ssoConnectionsQueryKey,
  ssoImportPreviewQueryKey,
} from "@/views/auth/settings/sso/sso-connections-query";
import {
  MY_FILES_IDENTITY_ROOT,
  myFilesQueryKey,
  myFilesQueryRoot,
} from "@/views/files/my-files-query";

import { removeUserIdentityQueries } from "./queries";
import { SESSION_QUERY_KEY } from "./state";

/** Two visitors, so "drops the previous owner's partition" can mean something. */
const ALICE = 7;
const BOB = 9;

/** The private families, built by the real key factories rather than by hand. */
const ALICE_FILES = [
  ...myFilesQueryKey({ params: { first: "25" }, userId: ALICE }),
];
const ALICE_FILES_PAGE_TWO = [
  ...myFilesQueryKey({ params: { cursor: "abc", first: "25" }, userId: ALICE }),
];
const BOB_FILES = [
  ...myFilesQueryKey({ params: { first: "25" }, userId: BOB }),
];
const ALICE_DEVICES = [...devicesQueryKey(ALICE)];
const BOB_DEVICES = [...devicesQueryKey(BOB)];
const ALICE_PASSKEYS = [...passkeysQueryKey(ALICE)];
const BOB_PASSKEYS = [...passkeysQueryKey(BOB)];
const ALICE_SSO = [...ssoConnectionsQueryKey(ALICE)];
const ALICE_SSO_PREVIEW = [...ssoImportPreviewQueryKey(ALICE, "google")];
const BOB_SSO = [...ssoConnectionsQueryKey(BOB)];

const SESSION = [...SESSION_QUERY_KEY];
const INTL = ["vitnode", "intl", "en", ["core.global"]];
const MIDDLEWARE = ["vitnode", "middleware"];
const PUBLIC_FEED = ["search", { sort: "newest" }, "en"];
const ADMIN_SCREEN = ["vitnode", "admin", "files", { page: 1 }];
const PLUGIN = ["@vitnode/example", "articles"];

const seeded = (): QueryClient => {
  const queryClient = new QueryClient();

  for (const key of [
    ALICE_FILES,
    ALICE_FILES_PAGE_TWO,
    BOB_FILES,
    ALICE_DEVICES,
    BOB_DEVICES,
    ALICE_PASSKEYS,
    BOB_PASSKEYS,
    ALICE_SSO,
    ALICE_SSO_PREVIEW,
    BOB_SSO,
    SESSION,
    INTL,
    MIDDLEWARE,
    PUBLIC_FEED,
    ADMIN_SCREEN,
    PLUGIN,
  ]) {
    queryClient.setQueryData(key, `data for ${JSON.stringify(key)}`);
  }

  return queryClient;
};

const held = (queryClient: QueryClient, key: unknown[]): boolean =>
  queryClient.getQueryData(key) !== undefined;

/**
 * The roots are prefixes of the keys they are meant to collect.
 *
 * The half that would fail silently if the two drifted: `removeQueries` matches
 * a key element by element, so a root that stopped being a prefix would collect
 * nothing and report nothing. Asserted against the real factories, so a
 * partition scheme that changes in one place and not the other fails here rather
 * than in a browser.
 */
describe("the identity roots prefix the keys they collect", () => {
  it("covers every page of every visitor's files", () => {
    expect([...myFilesQueryRoot(ALICE)].slice(0, 2)).toEqual([
      ...MY_FILES_IDENTITY_ROOT,
    ]);
    expect(ALICE_FILES.slice(0, 2)).toEqual([...MY_FILES_IDENTITY_ROOT]);
    expect(ALICE_FILES_PAGE_TWO.slice(0, 2)).toEqual([
      ...MY_FILES_IDENTITY_ROOT,
    ]);
  });

  it("covers every visitor's device list", () => {
    expect(ALICE_DEVICES.slice(0, 2)).toEqual([...DEVICES_IDENTITY_ROOT]);
  });

  it("covers every visitor's passkey list", () => {
    expect(ALICE_PASSKEYS.slice(0, 2)).toEqual([...PASSKEYS_IDENTITY_ROOT]);
  });

  it("covers every visitor's connected accounts and import previews", () => {
    expect(ALICE_SSO.slice(0, 2)).toEqual([...SSO_CONNECTIONS_IDENTITY_ROOT]);
    expect(ALICE_SSO_PREVIEW.slice(0, 2)).toEqual([
      ...SSO_CONNECTIONS_IDENTITY_ROOT,
    ]);
  });

  /**
   * And is genuinely *above* the per-owner root rather than equal to it. A
   * cleanup written as `myFilesQueryRoot(currentUser)` would drop the visitor
   * signing out and leave the one before them, which is the case that motivates
   * dropping a prefix at all.
   */
  it("is wider than one owner's partition", () => {
    expect(MY_FILES_IDENTITY_ROOT.length).toBeLessThan(
      myFilesQueryRoot(ALICE).length,
    );
    expect(DEVICES_IDENTITY_ROOT.length).toBeLessThan(
      devicesQueryKey(ALICE).length,
    );
  });
});

describe("removeUserIdentityQueries", () => {
  it("drops every page of every visitor's files", () => {
    const queryClient = seeded();

    removeUserIdentityQueries(queryClient);

    expect(held(queryClient, ALICE_FILES)).toBe(false);
    expect(held(queryClient, ALICE_FILES_PAGE_TWO)).toBe(false);
    expect(held(queryClient, BOB_FILES)).toBe(false);
  });

  it("drops every visitor's device list", () => {
    const queryClient = seeded();

    removeUserIdentityQueries(queryClient);

    expect(held(queryClient, ALICE_DEVICES)).toBe(false);
    expect(held(queryClient, BOB_DEVICES)).toBe(false);
  });

  it("drops every visitor's passkey list", () => {
    const queryClient = seeded();

    removeUserIdentityQueries(queryClient);

    expect(held(queryClient, ALICE_PASSKEYS)).toBe(false);
    expect(held(queryClient, BOB_PASSKEYS)).toBe(false);
  });

  it("drops every visitor's connected accounts and import previews", () => {
    const queryClient = seeded();

    removeUserIdentityQueries(queryClient);

    expect(held(queryClient, ALICE_SSO)).toBe(false);
    expect(held(queryClient, ALICE_SSO_PREVIEW)).toBe(false);
    expect(held(queryClient, BOB_SSO)).toBe(false);
  });

  /**
   * Removal, not invalidation: nothing is left for the next render to paint.
   * An invalidated entry keeps its value, so the previous visitor's rows would
   * still be on screen until a refetch returned - which is the frame this whole
   * function exists to remove.
   */
  it("removes rather than marking stale", () => {
    const queryClient = seeded();

    removeUserIdentityQueries(queryClient);

    expect(
      queryClient.getQueryCache().findAll({ queryKey: MY_FILES_IDENTITY_ROOT }),
    ).toEqual([]);
    expect(
      queryClient.getQueryCache().findAll({ queryKey: DEVICES_IDENTITY_ROOT }),
    ).toEqual([]);
  });

  /**
   * A list of prefixes, never `queryClient.clear()`.
   *
   * The session is the one worth spelling out: a sign-out *writes* the anonymous
   * session and then invalidates it, so an entry has to be there to write. The
   * messages, the middleware config and the public feed are the same data for
   * every visitor and re-fetching them because somebody signed in is the blunt
   * version of this. The AdminCP entry is not this function's either - it has
   * its own list, and the two are called side by side rather than merged.
   */
  it("leaves the session, the public caches and the AdminCP's own list", () => {
    const queryClient = seeded();

    removeUserIdentityQueries(queryClient);

    expect(held(queryClient, SESSION)).toBe(true);
    expect(held(queryClient, INTL)).toBe(true);
    expect(held(queryClient, MIDDLEWARE)).toBe(true);
    expect(held(queryClient, PUBLIC_FEED)).toBe(true);
    expect(held(queryClient, ADMIN_SCREEN)).toBe(true);
    expect(held(queryClient, PLUGIN)).toBe(true);
  });
});
