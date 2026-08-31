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

/**
 * A sample administrator, for the screens whose keys are partitioned by identity.
 *
 * The assertions below are about *where* a screen's entries hang, and that is
 * the same answer for every identity - so one stands in for all of them.
 */
const ADMIN_ID = 7;

const ROOTS = {
  cron: cronQueryRoot,
  dashboard: dashboardLayoutQueryKey(ADMIN_ID),
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

/**
 * The dashboard is the one screen whose entry belongs to *a person* rather than
 * to the installation, so its key has to say which person.
 *
 * `core_admin_dashboard` stores one row per administrator under a `UNIQUE`
 * constraint on `userId`. A key that omitted the id would mean two
 * administrators sharing one entry - and because the AdminCP runs
 * `refetchOnMount: false`, the second one would be *rendered* the first one's
 * board rather than merely fetching it again, and a save from that board would
 * write the first one's widget ids into the second one's row.
 *
 * Removal covers the boundaries this application performs itself, which is why
 * this was never reachable through a sign-in. What partitioning adds is the case
 * removal cannot see: an identity that changes without this tab running a
 * sign-out - a second administrator signing in elsewhere in the same browser -
 * where the guard re-reads the session but nothing drops the screen entries.
 */
describe("the dashboard is partitioned by administrator", () => {
  it("gives two administrators two different entries", () => {
    expect(JSON.stringify(dashboardLayoutQueryKey(1))).not.toBe(
      JSON.stringify(dashboardLayoutQueryKey(2)),
    );
  });

  it("carries the id, so neither can address the other's", () => {
    expect(dashboardLayoutQueryKey(ADMIN_ID)).toContain(ADMIN_ID);
  });

  it("keeps a denied read out of every administrator's entry", () => {
    // `null` is a real partition rather than a missing one: it is the key a read
    // with no granted session uses, and it must collide with nobody.
    expect(JSON.stringify(dashboardLayoutQueryKey(null))).not.toBe(
      JSON.stringify(dashboardLayoutQueryKey(ADMIN_ID)),
    );
  });

  it("stays inside the panel's prefix, so a sign-out still drops it", () => {
    // Partitioning is the second mechanism, not a replacement for the first.
    expect(isUnder(dashboardLayoutQueryKey(ADMIN_ID), ADMIN_QUERY_ROOT)).toBe(
      true,
    );
    expect(isUnder(dashboardLayoutQueryKey(null), ADMIN_QUERY_ROOT)).toBe(true);
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
