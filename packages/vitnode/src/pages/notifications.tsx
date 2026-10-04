import type { PluginRoutePageProps } from "@/routing";

import type { NotificationsRouteData } from "../tanstack/notifications/route";
import type { NotificationsRouteSearch } from "../tanstack/notifications/route-search";

import { NotificationsBreadcrumb } from "../tanstack/notifications/breadcrumb";
import { loadNotificationsRoute } from "../tanstack/notifications/route";
import { NotificationsRouteContent } from "../tanstack/notifications/screen";
import { defineAuthenticatedRoute } from "../tanstack/plugin-routes";

const NotificationsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<NotificationsRouteData, NotificationsRouteSearch>) => (
  <NotificationsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search}
  />
);

export const route = defineAuthenticatedRoute<
  NotificationsRouteData,
  NotificationsRouteSearch
>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadNotificationsRoute({ ...context, search, t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),

  breadcrumb: NotificationsBreadcrumb,
});

export default NotificationsPage;
