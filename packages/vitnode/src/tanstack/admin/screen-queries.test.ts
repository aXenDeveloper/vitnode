import { describe, expect, it } from "vitest";

import { ADMIN_QUERY_ROOT } from "@/views/admin/table/query";
import {
  cronQueryKey,
  cronQueryRoot,
} from "@/views/admin/views/core/advanced/cron/cron-query";
import {
  queueQueryKey,
  queueQueryRoot,
} from "@/views/admin/views/core/advanced/queue/queue-query";
import { searchIndexQueryKey } from "@/views/admin/views/core/advanced/search/search-index-query";
import { dashboardLayoutQueryKey } from "@/views/admin/views/core/dashboard/widgets/layout-query";
import {
  debugLogsQueryKey,
  debugLogsQueryRoot,
  debugQueueQueryKey,
} from "@/views/admin/views/core/debug/debug-query";
import {
  adminFilesQueryKey,
  adminFilesQueryRoot,
} from "@/views/admin/views/core/system/files/files-query";
import { integrationsQueryKey } from "@/views/admin/views/core/system/integrations/integrations-query";

import { ADMIN_SESSION_QUERY_KEY } from "./state";

/**
 * Where the AdminCP's screens keep their cache entries, and what that buys.
 *
 * Three properties, and every one of them is invisible until it is wrong:
 *
 * - **One prefix for the whole panel**, so a sign-out drops all of it in a
 *   single `removeQueries` rather than needing a list somebody has to extend.
 * - **A root per screen**, so a mutation invalidates its own family and not the
 *   panel. Running a cron job must not refetch the file table.
 * - **The session is not under it.** `removeAdminSession` owns that entry, and a
 *   screen's invalidation must never collect the permission set the shell is
 *   rendering from.
 *
 * Query matches keys element by element, so `["vitnode","admin"]` is a prefix of
 * `["vitnode","admin","cron", …]` and is *not* a prefix of
 * `["vitnode","admin-session"]`. That distinction is the whole test.
 */

/** Query's own rule: is `key` inside the family `prefix` names? */
const isUnder = (
  key: readonly unknown[],
  prefix: readonly unknown[],
): boolean => prefix.every((segment, index) => key[index] === segment);

const ROOTS = {
  cron: cronQueryRoot,
  dashboard: dashboardLayoutQueryKey,
  "debug-logs": debugLogsQueryRoot,
  "debug-queue": debugQueueQueryKey,
  files: adminFilesQueryRoot,
  integrations: integrationsQueryKey,
  queue: queueQueryRoot,
  "search-index": searchIndexQueryKey,
};

describe("every screen hangs off the panel's one prefix", () => {
  it.each(Object.entries(ROOTS))("%s", (_name, root) => {
    expect(isUnder(root, ADMIN_QUERY_ROOT)).toBe(true);
  });

  it("gives each screen a root of its own", () => {
    const roots = Object.values(ROOTS).map(root => JSON.stringify(root));

    expect(new Set(roots).size).toBe(roots.length);
  });

  it("keeps no screen inside another", () => {
    // A root that were a prefix of a second screen's would make one screen's
    // invalidation silently refetch the other's.
    for (const [name, root] of Object.entries(ROOTS)) {
      for (const [otherName, other] of Object.entries(ROOTS)) {
        if (name === otherName) continue;

        expect(isUnder(other, root), `${otherName} under ${name}`).toBe(false);
      }
    }
  });
});

describe("the admin session is not a screen", () => {
  it("is outside the panel's prefix", () => {
    // `"admin"` and `"admin-session"` are different second segments, which is
    // what stops a screen's invalidation touching the permission set.
    expect(isUnder(ADMIN_SESSION_QUERY_KEY, ADMIN_QUERY_ROOT)).toBe(false);
  });

  it.each(Object.entries(ROOTS))("is not inside %s either", (_name, root) => {
    expect(isUnder(ADMIN_SESSION_QUERY_KEY, root)).toBe(false);
  });
});

describe("a paged screen's key is its normalised request", () => {
  it("puts the parameters under the screen's root", () => {
    const params = { first: "10", orderBy: "lastRun" } as const;

    expect(cronQueryKey(params)).toEqual([...cronQueryRoot, params]);
    expect(isUnder(cronQueryKey(params), cronQueryRoot)).toBe(true);
  });

  it.each([
    ["cron", cronQueryKey, cronQueryRoot],
    ["queue", queueQueryKey, queueQueryRoot],
    ["files", adminFilesQueryKey, adminFilesQueryRoot],
    ["debug logs", debugLogsQueryKey, debugLogsQueryRoot],
  ] as const)("keeps %s's pages inside its own family", (_name, key, root) => {
    expect(isUnder(key({ first: "10" }), root)).toBe(true);
    expect(isUnder(key({ first: "25" }), root)).toBe(true);
  });

  it("distinguishes two requests that differ only in a filter", () => {
    // Two filters are two different sets of rows, so they have to be two
    // entries. Query hashes keys structurally, so comparing the serialised key
    // is what it will actually compare.
    expect(JSON.stringify(queueQueryKey({ first: "10" }))).not.toBe(
      JSON.stringify(queueQueryKey({ first: "10", status: "failed" })),
    );
  });
});
