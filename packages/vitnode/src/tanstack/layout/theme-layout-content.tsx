import { ThemeLayoutContent as ThemeLayoutFrame } from "@/views/layouts/theme/layout-content";

import {
  SiteOfflineScreen,
  SiteOfflineStaffBanner,
  useSiteOfflineView,
} from "../site-status/gate";

/**
 * The public site's page frame: `listeners`, then `header`, then `breadcrumb`,
 * then the page inside `<main>`. While the site is offline, visitors who may
 * not use it get the offline page instead (see `SiteOfflineGate`); pair it
 * with `loadMainShell` in the route's loader.
 *
 * @example
 * ```tsx
 * import { Outlet } from "@tanstack/react-router";
 * import { MainBreadcrumb } from "@vitnode/core/tanstack/breadcrumb";
 * import { MainHeader, ThemeLayoutContent } from "@vitnode/core/tanstack/layout";
 *
 * const MainLayout = () => (
 *   <ThemeLayoutContent breadcrumb={<MainBreadcrumb />} header={<MainHeader />}>
 *     <Outlet />
 *   </ThemeLayoutContent>
 * );
 * ```
 */
export const ThemeLayoutContent = ({
  breadcrumb,
  ...props
}: React.ComponentProps<typeof ThemeLayoutFrame>) => {
  const view = useSiteOfflineView();
  if (view === "closed") return <SiteOfflineScreen />;

  return (
    <ThemeLayoutFrame
      breadcrumb={
        view === "staff" ? (
          <>
            <SiteOfflineStaffBanner />
            {breadcrumb}
          </>
        ) : (
          breadcrumb
        )
      }
      {...props}
    />
  );
};
