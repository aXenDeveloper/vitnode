import type { PluginRoutePageProps } from "@/routing";

import { ModcpBreadcrumb } from "@/tanstack/moderation/breadcrumb";
import { ModcpLayoutContent } from "@/tanstack/moderation/layout";
import { requireModeratorRoute } from "@/tanstack/moderation/route";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";

const ModcpLayout = ({
  children,
}: PluginRoutePageProps & { children: React.ReactNode }) => (
  <ModcpLayoutContent>{children}</ModcpLayoutContent>
);

export const route = defineAuthenticatedRoute({
  load: ({ context }) => {
    requireModeratorRoute(context.auth);
  },
  head: () => ({ robots: "noindex, nofollow" }),

  breadcrumb: ModcpBreadcrumb,
});

export default ModcpLayout;
