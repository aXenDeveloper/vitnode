import { AlertTriangleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { CONFIG } from "@/lib/config";

import type { DashboardHeaderContent } from "./widgets/types";

import { DashboardBoard } from "./dashboard-board";
import { DashboardBoardSkeleton } from "./dashboard-board-skeleton";

const DashboardVersion = async () => {
  const [session, t] = await Promise.all([
    getSessionAdminApi(),
    getTranslations("admin.dashboard"),
  ]);
  if (!session) return null;

  return t("version", { version: session.vitnode_version });
};

export const DashboardAdminView = async () => {
  const t = await getTranslations("admin.dashboard");

  const header: DashboardHeaderContent = {
    desc: (
      <React.Suspense fallback={<Skeleton className="h-5 w-48" />}>
        <DashboardVersion />
      </React.Suspense>
    ),
    h1: (
      <>
        <span>VitNode</span>
        {CONFIG.node_development && (
          <Badge
            className="ml-2 bg-yellow-500 text-black hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-500"
            variant="destructive"
          >
            <AlertTriangleIcon className="size-4" /> {t("dev_mode")}
          </Badge>
        )}
      </>
    ),
  };

  return (
    <div className="p-4">
      <I18nProvider namespaces={["admin.dashboard"]}>
        <React.Suspense fallback={<DashboardBoardSkeleton header={header} />}>
          <DashboardBoard header={header} />
        </React.Suspense>
      </I18nProvider>
    </div>
  );
};
