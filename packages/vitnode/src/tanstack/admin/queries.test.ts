import { QueryClient } from "@tanstack/react-query";
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

/** The privileged families, one representative key each. */
const ADMIN_SESSION = [...ADMIN_SESSION_QUERY_KEY];
const ADMIN_SEARCH_USERS = [...ADMIN_SEARCH_USERS_QUERY_KEY, "ann"];
const ADMIN_SCREEN = [...adminQueryRoot("files"), { page: 1 }];
const ADMIN_DASHBOARD = [...adminQueryRoot("dashboard-layout")];

const CONTENT_LIST = [...contentListQueryKey("blog.post", { first: "25" })];
const CONTENT_ITEM = [...contentItemQueryKey("blog.post", 42)];
const CONTENT_OPTIONS = [
  ...contentOptionsQueryKey("blog.category", "category", "en"),
];

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
