import type { ContentContainerRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { AdminBreadcrumb } from "../breadcrumb";

export type ContentContainerBreadcrumbProps = Partial<
  Pick<ContentContainerRouteData, "adminPath" | "namespaces" | "title">
>;

export const ContentContainerBreadcrumbContent = ({
  adminPath,
  namespaces,
  title,
}: ContentContainerBreadcrumbProps) => {
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
