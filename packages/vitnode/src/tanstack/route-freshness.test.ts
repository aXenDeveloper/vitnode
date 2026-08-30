import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  OPERATIONAL_STALE_TIME,
  RECORD_STALE_TIME,
} from "@/lib/query-freshness";
import { middlewareConfigQueryOptions } from "@/tanstack/auth/middleware-config";
import { intlQueryOptions } from "@/tanstack/i18n/query";
import { cronQueryOptions } from "@/views/admin/views/core/advanced/cron/cron-query";
import { queueQueryOptions } from "@/views/admin/views/core/advanced/queue/queue-query";
import { searchIndexQueryOptions } from "@/views/admin/views/core/advanced/search/search-index-query";
import { dashboardLayoutQueryOptions } from "@/views/admin/views/core/dashboard/widgets/layout-query";
import {
  debugLogsQueryOptions,
  debugQueueQueryOptions,
} from "@/views/admin/views/core/debug/debug-query";
import { adminStaffQueryOptions } from "@/views/admin/views/core/staff/staff-query";
import { adminFilesQueryOptions } from "@/views/admin/views/core/system/files/files-query";
import { integrationsQueryOptions } from "@/views/admin/views/core/system/integrations/integrations-query";
import { adminUserQueryOptions } from "@/views/admin/views/core/users/detail/user-query";
import { adminUsersQueryOptions } from "@/views/admin/views/core/users/list/users-query";
import { adminRolesQueryOptions } from "@/views/admin/views/core/users/roles/roles-query";
import { devicesQueryOptions } from "@/views/auth/settings/devices/devices-query";
import { myFilesQueryOptions } from "@/views/files/my-files-query";
import { searchFeedQueryOptions } from "@/views/search/search-feed-query";

import { ADMIN_SESSION_QUERY_KEY } from "./admin/state";

/**
 * What a route promises about the age of what it shows.
 *
 * Route loaders read through `ensureQueryData`, which hands back whatever is
 * cached the moment anything is cached. With `refetchOnMount` and
 * `refetchOnWindowFocus` both off - and they stay off - that made a revisited
 * route show the first visit's data for as long as the tab lived. The contract
 * that fixes it has two halves in two places, so it has one test:
 *
 *     the query family    declares how long its answer stays good
 *     the route loader    declares what to do once it is not
 *
 * Both halves are asserted here because either alone is silently useless: a
 * `staleTime` with no `revalidateIfStale` never refreshes, and a
 * `revalidateIfStale` with no `staleTime` refreshes on every hover.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..");

const PARAMS = { first: "10" } as const;

describe("the freshness windows", () => {
  it("are ordered: data that moves on its own is checked sooner", () => {
    expect(OPERATIONAL_STALE_TIME).toBeLessThan(RECORD_STALE_TIME);
  });

  it("are real windows, not zero and not forever", () => {
    for (const window of [OPERATIONAL_STALE_TIME, RECORD_STALE_TIME]) {
      expect(window).toBeGreaterThan(0);
      expect(Number.isFinite(window)).toBe(true);
    }
  });

  /**
   * Long enough that crossing a sidebar costs nothing.
   *
   * `defaultPreload: 'intent'` runs a loader on hover, so a window shorter than
   * the time a pointer takes to cross a list of links would put a background
   * request behind each one - the hover storm, arrived at from the other side.
   */
  it("are longer than a pointer takes to cross a sidebar", () => {
    expect(OPERATIONAL_STALE_TIME).toBeGreaterThanOrEqual(5_000);
  });
});

describe("data that moves on its own takes the operational window", () => {
  it.each([
    ["cron", cronQueryOptions({ params: PARAMS })],
    ["queue", queueQueryOptions({ params: PARAMS })],
    ["search index", searchIndexQueryOptions()],
    ["debug logs", debugLogsQueryOptions({ params: PARAMS })],
    ["debug queue", debugQueueQueryOptions()],
  ])("%s", (_name, options) => {
    expect(options.staleTime).toBe(OPERATIONAL_STALE_TIME);
  });
});

describe("data a person edits takes the record window", () => {
  it.each([
    ["admin users", adminUsersQueryOptions({ adminUserId: 7, params: PARAMS })],
    ["admin user detail", adminUserQueryOptions({ adminUserId: 7, id: "1" })],
    ["admin roles", adminRolesQueryOptions({ adminUserId: 7, params: PARAMS })],
    [
      "admin staff",
      adminStaffQueryOptions({
        adminUserId: 7,
        params: PARAMS,
        type: "admin",
      }),
    ],
    ["admin files", adminFilesQueryOptions({ params: PARAMS })],
    ["integrations", integrationsQueryOptions()],
    ["dashboard layout", dashboardLayoutQueryOptions({ adminUserId: 7 })],
    ["my files", myFilesQueryOptions({ params: PARAMS, userId: 1 })],
    ["devices", devicesQueryOptions({ userId: 1 })],
    [
      "search feed",
      searchFeedQueryOptions({ locale: "en", params: { search: "x" } }),
    ],
  ])("%s", (_name, options) => {
    expect(options.staleTime).toBe(RECORD_STALE_TIME);
  });
});

/**
 * The families deliberately left alone, asserted so nobody "finishes the job".
 *
 * Each of these is stable for a reason that has nothing to do with revisits, and
 * giving them a revalidation window would spend requests refetching data that
 * has not changed.
 */
describe("stable data keeps its own longer-lived policy", () => {
  it("message catalogues change when the app is redeployed, not on revisit", () => {
    expect(intlQueryOptions({ locale: "en" }).staleTime).toBe(Infinity);
  });

  it("the middleware config keeps its own five minutes", () => {
    const { staleTime } = middlewareConfigQueryOptions();

    expect(staleTime).toBeGreaterThan(RECORD_STALE_TIME);
  });
});

/**
 * The other half: the loaders that actually ask for the refresh.
 *
 * A source scan, because what is being pinned is that the call site opted in -
 * `revalidateIfStale` is an `ensureQueryData` option, not a query option, so it
 * cannot be read off the options object the way the windows above can.
 */
describe("route loaders ask for the refresh", () => {
  const sourceOf = (file: string) => readFileSync(join(src, file), "utf8");

  it.each([
    ["tanstack/admin/cron/route.tsx"],
    ["tanstack/admin/queue/route.tsx"],
    ["tanstack/admin/files/route.tsx"],
    ["tanstack/admin/integrations/route.tsx"],
    ["tanstack/admin/search-index/route.tsx"],
    ["tanstack/admin/debug/route.tsx"],
    ["tanstack/admin/users/route.tsx"],
    ["tanstack/admin/users/detail-route.tsx"],
    ["tanstack/admin/roles/route.tsx"],
    ["tanstack/admin/staff/route.tsx"],
    ["tanstack/admin/staff/edit-route.tsx"],
    ["tanstack/admin/dashboard/route.tsx"],
    ["tanstack/admin/content/route.tsx"],
    ["tanstack/admin/content/form/route.tsx"],
    ["tanstack/files/route.tsx"],
    ["tanstack/search/search-route.tsx"],
    ["tanstack/search/discover-route.tsx"],
  ])("%s revalidates what it reads", file => {
    expect(sourceOf(file)).toContain("revalidateIfStale: true");
  });

  /**
   * And the guard does not.
   *
   * `_admin`'s session read is the one entry in VitNode that may never be
   * answered from memory: its `staleTime` is `0` as a revocation guarantee, and
   * a stale-while-revalidate read there would hand a guard the previous
   * decision while it checked. It is not a revisit-freshness problem and must
   * not be given a revisit-freshness fix.
   */
  it("except the admin session, which may not be answered from cache at all", () => {
    const guard = readFileSync(
      resolve(src, "../../../apps/web/src/routes/_admin.tsx"),
      "utf8",
    );

    expect(guard).not.toContain("revalidateIfStale");
    expect(ADMIN_SESSION_QUERY_KEY).toEqual(["vitnode", "admin-session"]);
  });
});
