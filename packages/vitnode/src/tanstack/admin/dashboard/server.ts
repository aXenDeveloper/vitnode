import "@tanstack/react-start/server-only";

import type { adminModule } from "@/api/modules/admin/admin.module";
import type { DashboardLayoutFetcher } from "@/views/admin/views/core/dashboard/widgets/layout-query";

import { adminModuleRef } from "@/views/admin/admin-request";
import { dashboardLayoutRequest } from "@/views/admin/views/core/dashboard/widgets/layout-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * The administrator's stored dashboard layout, fetched during SSR.
 *
 * `fetcherServer` forwards the admin cookie the page request arrived with, which
 * is what makes this *their* layout rather than an anonymous `403`.
 *
 * A refusal is an empty layout, not an error - the same rule the browser fetcher
 * and the Next.js board apply, and the reason is in
 * `views/.../widgets/layout-query.ts`: an administrator without
 * `dashboard.can_view` should get the default board rather than a broken landing
 * page.
 */
export const fetchDashboardLayoutOnServer: DashboardLayoutFetcher =
  async () => {
    const response = await fetcherServer(
      adminModuleRef<typeof adminModule>(),
      dashboardLayoutRequest,
    );

    if (!response.ok) return [];

    return (await response.json()).widgets;
  };
