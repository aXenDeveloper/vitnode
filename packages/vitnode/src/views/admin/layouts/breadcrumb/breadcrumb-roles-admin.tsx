import type { VitNodeConfig } from "@/vitnode.config";

import { BreadcrumbAdmin } from "./breadcrumb-admin";

export const BreadcrumbRolesAdmin = ({
  vitNodeConfig,
}: {
  vitNodeConfig?: VitNodeConfig;
}) => {
  return (
    <BreadcrumbAdmin
      segments={["core", "users", "roles"]}
      vitNodeConfig={vitNodeConfig}
    />
  );
};
