import { useTranslations } from "use-intl";

import { RouteMessages } from "../../i18n/route-messages";
import { AdminBreadcrumb } from "../breadcrumb";
import { DEBUG_PATH } from "./route-search";

const DEBUG_BREADCRUMB_NAMESPACES = ["admin.debug"] as const;

const DebugCrumbs = () => {
  const t = useTranslations("admin.debug");

  return (
    <AdminBreadcrumb
      labels={{ [DEBUG_PATH]: t("title") }}
      segments={["core", "debug"]}
    />
  );
};

export const AdminDebugBreadcrumbContent = () => (
  <RouteMessages namespaces={DEBUG_BREADCRUMB_NAMESPACES}>
    <DebugCrumbs />
  </RouteMessages>
);
