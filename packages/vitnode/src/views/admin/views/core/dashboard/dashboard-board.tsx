import { adminModule } from "@/api/modules/admin/admin.module";
import { HeaderContent } from "@/components/ui/header-content";
import { fetcher } from "@/lib/fetcher";

import type { DashboardHeaderContent } from "./widgets/types";

import { DashboardBoardProviderNext } from "./grid/board-provider-next";
import { DashboardGrid } from "./grid/dashboard-grid";
import { DashboardEditActions } from "./grid/edit-actions";
import { buildDashboardBoard } from "./widgets/build-board";
import { getDashboardWidgets } from "./widgets/get-dashboard-widgets";

/**
 * The Next.js half of the dashboard board: read the widgets and the stored
 * layout, then hand the assembled board to the shared provider.
 *
 * A Server Component, so `getDashboardWidgets()` reads the app config and the
 * admin session through the request scope, and every widget's `component` is
 * rendered *here* - which is what lets a widget be a Server Component.
 * `buildDashboardBoard` is the shared arithmetic, and `DashboardBoardProviderNext`
 * binds the four actions.
 *
 * A failed layout read falls back to no stored layout rather than erroring, and
 * that is deliberate: `dashboard.can_view` gates the read, and an admin without
 * it should still get the default board rather than a broken page.
 */
export const DashboardBoard = async ({
  header,
}: {
  header: DashboardHeaderContent;
}) => {
  const [widgets, res] = await Promise.all([
    getDashboardWidgets(),
    fetcher(adminModule, {
      path: "/",
      method: "get",
      module: "admin/dashboard",
    }),
  ]);

  const saved = res.ok ? (await res.json()).widgets : [];
  const { catalog, content, layout, managedIds } = buildDashboardBoard({
    saved,
    widgets,
  });

  return (
    <DashboardBoardProviderNext
      catalog={catalog}
      content={content}
      layout={layout}
      managedIds={managedIds}
    >
      <HeaderContent desc={header.desc} h1={header.h1}>
        <DashboardEditActions />
      </HeaderContent>

      <DashboardGrid />
    </DashboardBoardProviderNext>
  );
};
