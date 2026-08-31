import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ADMIN_SEARCH_USERS_QUERY_KEY } from "@/views/admin/layouts/search/search-users";
import { adminQueryRoot } from "@/views/admin/table/query";
import {
  contentItemQueryKey,
  contentListQueryKey,
  contentOptionsQueryKey,
} from "@/views/admin/views/content/content-query";

import { removeAdminIdentityQueries, removeAdminShellQueries } from "./queries";
import { ADMIN_SESSION_QUERY_KEY } from "./state";

/**
 * What an identity boundary throws away, and - just as load-bearing - what it
 * leaves alone.
 *
 * A `QueryClient` with data written into it and nothing else: no router, no
 * React, no server. Every assertion below is a statement about the *cache*,
 * which is the only thing these functions touch, so this is the whole of the
 * unit rather than a stand-in for one.
 *
 * The failure this guards against is silent by construction. A cache entry that
 * outlives the administrator it belonged to renders perfectly - it is somebody
 * else's data, drawn correctly - and there is no error, no warning and nothing
 * in a log. It only ever appears as one administrator being shown another's
 * screen, on a shared browser, after the first one's session ended.
 */

/** The privileged families, one representative key each. */
const ADMIN_SESSION = [...ADMIN_SESSION_QUERY_KEY];
const ADMIN_SEARCH_USERS = [...ADMIN_SEARCH_USERS_QUERY_KEY, "ann"];
const ADMIN_SCREEN = [...adminQueryRoot("files"), { page: 1 }];
const ADMIN_DASHBOARD = [...adminQueryRoot("dashboard-layout")];

/**
 * The Content Engine, one key per level of its family.
 *
 * Built by the real key builders rather than written out, because the property
 * being checked is that *those* stay under the AdminCP root - a key spelled by
 * hand here would keep passing after `content-query.ts` moved the family
 * somewhere this cleanup cannot reach.
 *
 * There is deliberately no `removeContentQueries` beside the two functions under
 * test. `contentQueryRoot()` is `["vitnode","admin","content"]`, so the existing
 * prefix removal already collects every content type an installation has and
 * every one a plugin adds later. A second per-feature cleanup list would be one
 * more thing to remember and one more thing to forget.
 */
const CONTENT_LIST = [...contentListQueryKey("blog.post", { first: "25" })];
const CONTENT_ITEM = [...contentItemQueryKey("blog.post", 42)];
const CONTENT_OPTIONS = [
  ...contentOptionsQueryKey("blog.category", "category", "en"),
];

/**
 * Entries that belong to other layers, and must survive.
 *
 * The public session is the pointed one: it is a different cookie answering a
 * different question, and `tanstack/auth` owns its lifecycle. A cleanup that
 * collected it would sign a visitor out of the public site because an
 * administrator signed in to the panel.
 */
const PUBLIC_SESSION = ["vitnode", "session"];
const INTL = ["vitnode", "intl", "en", ["core.global"]];
const PLUGIN = ["@vitnode/example", "articles"];

const seeded = (): QueryClient => {
  const queryClient = new QueryClient();

  for (const key of [
    ADMIN_SESSION,
    ADMIN_SEARCH_USERS,
    ADMIN_SCREEN,
    ADMIN_DASHBOARD,
    CONTENT_LIST,
    CONTENT_ITEM,
    CONTENT_OPTIONS,
    PUBLIC_SESSION,
    INTL,
    PLUGIN,
  ]) {
    queryClient.setQueryData(key, `data for ${JSON.stringify(key)}`);
  }

  return queryClient;
};

const held = (queryClient: QueryClient, key: unknown[]): boolean =>
  queryClient.getQueryData(key) !== undefined;

describe("removeAdminShellQueries", () => {
  it("drops every AdminCP screen family and the palette's user lookups", () => {
    const queryClient = seeded();

    removeAdminShellQueries(queryClient);

    expect(held(queryClient, ADMIN_SEARCH_USERS)).toBe(false);
    expect(held(queryClient, ADMIN_SCREEN)).toBe(false);
    expect(held(queryClient, ADMIN_DASHBOARD)).toBe(false);
  });

  /**
   * The session entry has its own lifecycle, and a *screen* clearing must not
   * take it: the shell renders its sidebar from the permission set, and
   * dropping that from under a mounted panel is a different event entirely.
   */
  it("leaves the admin session entry alone", () => {
    const queryClient = seeded();

    removeAdminShellQueries(queryClient);

    expect(held(queryClient, ADMIN_SESSION)).toBe(true);
  });
});

describe("removeAdminIdentityQueries", () => {
  it("drops the admin session", () => {
    const queryClient = seeded();

    removeAdminIdentityQueries(queryClient);

    expect(held(queryClient, ADMIN_SESSION)).toBe(false);
  });

  /**
   * The half a `removeAdminSession` on its own left behind, and the reason this
   * function exists: a screen's rows are the previous administrator's private
   * data just as much as their permission set is.
   */
  it("drops the AdminCP screen data too", () => {
    const queryClient = seeded();

    removeAdminIdentityQueries(queryClient);

    expect(held(queryClient, ADMIN_SCREEN)).toBe(false);
    expect(held(queryClient, ADMIN_DASHBOARD)).toBe(false);
  });

  it("drops the palette's user search results", () => {
    const queryClient = seeded();

    removeAdminIdentityQueries(queryClient);

    expect(held(queryClient, ADMIN_SEARCH_USERS)).toBe(false);
  });

  /**
   * The Content Engine, which the AdminCP started rendering itself in Stage 13
   * and which added no cleanup of its own.
   *
   * That is the claim worth pinning: a content list is rows an administrator was
   * allowed to read, a record is one of them in full, and a reference picker is
   * a searchable index of another content type - all of it privileged, none of
   * it collected by anything but the prefix already removed above. The
   * reference-picker entry is the pointed one: it cached itself under the bare
   * string `"content-options"` before this stage, outside `["vitnode","admin"]`
   * and outside every removal, so one administrator's picker results were served
   * to the next person to sign in on that tab.
   */
  it("drops the Content Engine's lists, records and pickers", () => {
    const queryClient = seeded();

    removeAdminIdentityQueries(queryClient);

    expect(held(queryClient, CONTENT_LIST)).toBe(false);
    expect(held(queryClient, CONTENT_ITEM)).toBe(false);
    expect(held(queryClient, CONTENT_OPTIONS)).toBe(false);
  });

  /**
   * It is a list of prefixes, never `queryClient.clear()`. Clearing would turn
   * a sign-in into a full-cache eviction that re-fetches the whole application,
   * and would take the public session with it - which is not this layer's to
   * decide.
   */
  it("leaves the public session, the messages and a plugin's entries", () => {
    const queryClient = seeded();

    removeAdminIdentityQueries(queryClient);

    expect(held(queryClient, PUBLIC_SESSION)).toBe(true);
    expect(held(queryClient, INTL)).toBe(true);
    expect(held(queryClient, PLUGIN)).toBe(true);
  });

  /** Removal, not invalidation: nothing is left to render from. */
  it("removes rather than marking stale", () => {
    const queryClient = seeded();

    removeAdminIdentityQueries(queryClient);

    expect(
      queryClient.getQueryCache().findAll({ queryKey: ["vitnode", "admin"] }),
    ).toEqual([]);
    expect(queryClient.getQueryState(ADMIN_SESSION)).toBeUndefined();
  });
});

/**
 * Which flows call it, and in what order - as a source scan.
 *
 * A scan rather than a render, for the same reason the permission bridge is
 * scanned: what is being pinned is that a *call exists at all*, in a specific
 * place, before another one. A rendering test would need a router, a server
 * function and a real sign-in to reach these lines, and it would still not be
 * able to say the cleanup happened before the navigation rather than after it -
 * which is the half that decides whether the next administrator sees a frame of
 * somebody else's panel.
 *
 * The ordering assertions compare source positions. That is coarse, and it is
 * exactly as coarse as the property: these are straight-line statements in one
 * function body, so "appears earlier in the file" and "runs first" are the same
 * sentence.
 */
const here = dirname(fileURLToPath(import.meta.url));

const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const sourceOf = (relative: string): string =>
  withoutComments(readFileSync(join(here, relative), "utf8"));

const CLEANUP = "removeAdminIdentityQueries(queryClient)";

describe("this scan is looking at the right code", () => {
  it("still sees the calls under the comments", () => {
    // The control: a comment stripper that blanked a file would satisfy every
    // ordering assertion below by finding nothing at all.
    expect(sourceOf("actions.ts")).toContain(CLEANUP);
    expect(sourceOf("../auth/actions.ts")).toContain(CLEANUP);
  });
});

describe("every identity boundary drops the privileged cache", () => {
  /**
   * The Stage 12 blocker. A successful admin sign-in used to drop only
   * `["vitnode","admin-session"]`, so Admin B could arrive on a tab still
   * holding Admin A's screens - including the dashboard layout, which is
   * administrator-specific and not keyed by identity.
   */
  it("the admin sign-in clears before it navigates", () => {
    const code = sourceOf("actions.ts");

    expect(code).toContain(CLEANUP);
    expect(code.indexOf(CLEANUP)).toBeLessThan(
      code.indexOf("await navigate(destination())"),
    );
  });

  it("the admin sign-in does not settle for an invalidation", () => {
    expect(sourceOf("actions.ts")).not.toContain("invalidateAdminSession");
  });

  it("the admin sign-out clears, and again after the redirect", () => {
    // The action clears while the panel is still mounted; the user bar sweeps
    // once more after `router.invalidate()` has taken the administrator out of
    // it, in case an observer put an entry back in between.
    expect(sourceOf("../auth/actions.ts")).toContain(CLEANUP);
    expect(sourceOf("user-bar.tsx")).toContain(CLEANUP);
  });

  /**
   * The public flows, which do not touch the admin cookie - but do mean the
   * person at the keyboard may have changed. Conservative on purpose: stale
   * privileged data should not outlive an identity that may have.
   */
  it("the public auth actions clear on every identity change", () => {
    const code = sourceOf("../auth/actions.ts");

    // Sign-in, SSO completion, sign-out and a verified sign-up: four call
    // sites, one per flow that can change who is at the keyboard. A password
    // reset *request* is deliberately not one - it mints no session and the
    // visitor stays exactly who they were.
    expect(code.split(CLEANUP).length - 1).toBe(4);
  });

  it("the public sign-in clears before it navigates", () => {
    const code = sourceOf("../auth/actions.ts");

    expect(code.indexOf(CLEANUP)).toBeLessThan(
      code.indexOf("await navigate(destination())"),
    );
  });

  /**
   * And nothing anywhere reaches for the blunt instrument. `clear()` would take
   * the public session, the message catalogues and every plugin's entries with
   * it - a sign-in that re-fetches the whole application.
   */
  it("never clears the whole cache", () => {
    for (const file of [
      "queries.ts",
      "actions.ts",
      "user-bar.tsx",
      "../auth/actions.ts",
    ]) {
      expect(sourceOf(file), file).not.toContain("queryClient.clear(");
    }
  });
});
