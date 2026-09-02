import { queryOptions } from "@tanstack/react-query";

import type { adminModule } from "@/api/modules/admin/admin.module";
import type { AdminDashboardWidgetLayoutItem } from "@/database/dashboard";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { adminModuleRef } from "@/views/admin/admin-request";
import {
  ADMIN_DASHBOARD_SCREEN,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";

import type { DashboardMutationResult } from "./dashboard-actions";
import type { DashboardLayoutItem } from "./types";

/**
 * The signed-in administrator's own dashboard layout, as one query definition.
 *
 * `GET /admin/admin/dashboard` returns the widgets *this* administrator has
 * arranged - `dashboard.can_view`, re-checked on every request, and scoped to
 * the session's own user id by the handler.
 *
 * ## A failed read is an empty layout, and only here
 *
 * Every other AdminCP read in this migration throws on a refusal, because an
 * empty table is indistinguishable from an empty installation. This one is the
 * exception, and it is the exception the Next.js board already makes:
 * `res.ok ? (await res.json()).widgets : []`. An administrator without
 * `dashboard.can_view` is not being shown "no widgets" - they are being shown
 * the *default* board, which is what `normalizeLayout` produces from an empty
 * stored layout, and which is the correct dashboard for somebody who has never
 * arranged one. Failing the page instead would take the panel's landing screen
 * away from them entirely.
 */

const adminModuleClientRef = adminModuleRef<typeof adminModule>();

/** The read, as arguments to whichever fetcher is carrying it. */
/** What the layout read resolves to: the stored items, or none. */
export type DashboardStoredLayout = AdminDashboardWidgetLayoutItem[];

export type DashboardLayoutFetcher = () => Promise<DashboardStoredLayout>;

/** The stored layout, fetched from the browser. */
export const fetchDashboardLayoutInBrowser: DashboardLayoutFetcher =
  async () => {
    const response = await fetcherClient(adminModuleClientRef, {
      method: "get",
      module: "admin/dashboard",
      path: "/",
    });

    if (!response.ok) return [];

    return (await response.json()).widgets;
  };

/**
 * The cache entry the board reads and writes, for one administrator.
 *
 * Scoped by identity, and it is the one AdminCP key where that is about the data
 * being *owned* rather than being *shaped* - see `admin-scope.ts`. There is one
 * row per administrator in `core_admin_dashboard`, so there is one entry per
 * administrator here, and a second one signing in on the same tab addresses a
 * different key rather than inheriting the first one's board.
 *
 * A root and a key at once: a layout takes no parameters, so this screen has
 * exactly one entry per identity and nothing hangs below it.
 *
 * Removal still applies on top of this - `removeAdminShellQueries` drops the
 * whole `["vitnode","admin"]` prefix - because partitioning stops a second
 * identity *reading* the first one's entry and removal stops it being in memory
 * at all. Both, for the reason `admin-scope.ts` gives.
 */
export const dashboardLayoutQueryKey = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_DASHBOARD_SCREEN, adminUserId);

/**
 * The stored layout, as the one query definition every caller shares.
 *
 * No `retry`: the fetcher already answers a refusal with an empty layout, so
 * there is nothing for a retry to turn into a success. A transport failure still
 * rejects, and the route's error boundary owns that.
 *
 * `adminUserId` is required rather than defaulted, and deliberately so: a
 * default would let a caller that had not resolved the session yet write into
 * some other identity's entry - which is the failure this partition exists to
 * make impossible. `null` is the real key for a read with no granted session.
 */
export const dashboardLayoutQueryOptions = ({
  adminUserId,
  fetchLayout = fetchDashboardLayoutInBrowser,
}: {
  adminUserId: AdminIdentity;
  fetchLayout?: DashboardLayoutFetcher;
}) =>
  queryOptions({
    queryFn: async () => await fetchLayout(),
    queryKey: dashboardLayoutQueryKey(adminUserId),
    /** {@link RECORD_STALE_TIME} - One administrator's own board, which they may have rearranged in a second tab. */
    staleTime: RECORD_STALE_TIME,
  });

/**
 * The board, saved from the browser.
 *
 * `PUT /admin/admin/dashboard/layout` declares
 * `adminStaffPermission: { module: "dashboard", permission: "can_edit" }`.
 * `managed` is every stored id this board spoke for, so the API can tell a
 * widget the admin removed from one this board never knew about.
 *
 * Only the three fields the API stores are sent: `settings` belong to the widget
 * and are written by its own settings dialog, so a layout save must not carry -
 * and therefore cannot overwrite - them. That is the Next.js action's rule too.
 */
export const saveDashboardLayoutInBrowser = async ({
  managed,
  widgets,
}: {
  managed: string[];
  widgets: DashboardLayoutItem[];
}): Promise<DashboardMutationResult> => {
  try {
    const response = await fetcherClient(adminModuleClientRef, {
      args: {
        body: {
          managed,
          widgets: widgets.map(({ id, rows, span }) => ({ id, rows, span })),
        },
      },
      method: "put",
      module: "admin/dashboard",
      options: { credentials: "include" },
      path: "/layout",
    });

    if (!response.ok) return { error: await response.text() };

    return undefined;
  } catch {
    return { error: "Failed to save the dashboard layout." };
  }
};
