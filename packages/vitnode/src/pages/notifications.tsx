import type { PluginRoutePageProps } from "@/routing";

import type { NotificationsRouteData } from "../tanstack/notifications/route";
import type { UncheckedNotificationsSearch } from "../tanstack/notifications/route-search";

import { loadNotificationsRoute } from "../tanstack/notifications/route";
import { NotificationsRouteContent } from "../tanstack/notifications/screen";
import { defineAuthenticatedRoute } from "../tanstack/plugin-routes";

const NotificationsPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<
  NotificationsRouteData,
  UncheckedNotificationsSearch
>) => (
  <NotificationsRouteContent
    {...loaderData}
    navigate={navigate}
    search={search}
  />
);

export const route = defineAuthenticatedRoute<
  NotificationsRouteData,
  UncheckedNotificationsSearch
>({
  load: async ({ context, search, t }) =>
    await loadNotificationsRoute({ ...context, search, t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),
});

export default NotificationsPage;
