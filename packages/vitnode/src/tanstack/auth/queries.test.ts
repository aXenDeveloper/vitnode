import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DEVICES_IDENTITY_ROOT,
  devicesQueryKey,
} from "@/views/auth/settings/devices/devices-query";
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

/**
 * Which flows call it, as a source scan.
 *
 * The same technique, and the same justification, as the admin side's: what is
 * being pinned is that a *call exists at all*, in a specific place, before
 * another one. Reaching these lines by rendering would need a router, a server
 * function and a real sign-in, and would still not be able to say the cleanup
 * happened before the navigation - which is the half that decides whether the
 * next visitor sees a frame of somebody else's data.
 */
const here = dirname(fileURLToPath(import.meta.url));

const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const actionsSource = (): string =>
  withoutComments(readFileSync(join(here, "actions.ts"), "utf8"));

const CLEANUP = "removeUserIdentityQueries(queryClient)";

describe("every public identity boundary drops the private cache", () => {
  it("still sees the call under the comments", () => {
    // The control: a comment stripper that blanked the file would satisfy every
    // assertion below by finding nothing at all.
    expect(actionsSource()).toContain(CLEANUP);
  });

  /**
   * Four call sites, one per flow that can change who is at the keyboard: a
   * sign-in, a finished SSO exchange, a sign-out and a *verified* sign-up.
   *
   * An unverified sign-up is deliberately not one - no session was minted, so
   * nothing about who this browser holds data for has changed - and neither is a
   * password-reset request, which mints nothing and leaves the visitor exactly
   * who they were.
   */
  it("runs on all four, and only those four", () => {
    expect(actionsSource().split(CLEANUP).length - 1).toBe(4);
  });

  /**
   * Beside the admin cleanup, not instead of it. The two lists are separate
   * because they answer to different owners, and a boundary needs both.
   */
  it("runs alongside the AdminCP cleanup at every one of them", () => {
    const code = actionsSource();

    expect(
      code.split("removeAdminIdentityQueries(queryClient)").length - 1,
    ).toBe(4);
  });

  it("clears before it navigates", () => {
    const code = actionsSource();

    expect(code.indexOf(CLEANUP)).toBeLessThan(
      code.indexOf("await navigate(destination())"),
    );
  });

  /**
   * And never reaches for the blunt instrument. `clear()` would take the
   * session, the message catalogues and every plugin's entries with it - a
   * sign-in that re-fetches the whole application.
   */
  it("never clears the whole cache", () => {
    for (const file of ["queries.ts", "actions.ts"]) {
      expect(
        withoutComments(readFileSync(join(here, file), "utf8")),
        file,
      ).not.toContain("queryClient.clear(");
    }
  });
});
