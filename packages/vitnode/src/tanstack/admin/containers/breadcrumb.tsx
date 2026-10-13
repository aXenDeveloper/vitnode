import type { ContentContainerRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { AdminBreadcrumb } from "../breadcrumb";

export type ContentContainerBreadcrumbProps = Partial<
  Pick<ContentContainerRouteData, "adminPath" | "namespaces" | "title">
>;

/**
 * `Containers › Example › Boards`. The last crumb is the collection's own
 * heading; the sidebar entry at `/admin/containers/{path}` names it too, but the
 * heading may legitimately differ from the shorter sidebar name.
 */
export const ContentContainerBreadcrumbContent = ({
  adminPath,
  namespaces,
  title,
}: ContentContainerBreadcrumbProps) => {
  // The loader did not resolve - a 404, or a permission refusal.
  if (adminPath === undefined || title === undefined) return null;

  return (
    <RouteMessages namespaces={namespaces ?? []}>
      <AdminBreadcrumb
        overrideLastLabel={title}
        segments={["containers", ...adminPath.split("/")]}
      />
    </RouteMessages>
  );
};
