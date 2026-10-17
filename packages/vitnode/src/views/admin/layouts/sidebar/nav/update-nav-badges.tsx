import React from "react";
import { useTranslations } from "use-intl";

import { useAdminUpdateSummary } from "@/views/admin/views/core/system/plugins/update-summary-query";

import type { AdminNavBadges } from "./nav-badges";

import { AdminNavBadgesProvider } from "./nav-badges";
import { ADMIN_PLUGINS_HREF } from "./nav-model";

export const AdminUpdateNavBadges = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const t = useTranslations("admin.global.updates");
  const { data } = useAdminUpdateSummary();
  const count = data?.enabled ? data.updatesAvailable : 0;

  const badges = React.useMemo<AdminNavBadges>(
    () =>
      count > 0
        ? {
            [ADMIN_PLUGINS_HREF]: {
              count,
              label: t("nav_badge", { count }),
            },
          }
        : {},
    [count, t],
  );

  return (
    <AdminNavBadgesProvider value={badges}>{children}</AdminNavBadgesProvider>
  );
};
