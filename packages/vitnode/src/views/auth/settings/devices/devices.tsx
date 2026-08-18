import { getTranslations } from "next-intl/server";
import React from "react";

import { HeaderContent } from "@/components/ui/header-content";

import { DevicesList } from "./devices-list";
import { DevicesListSkeleton } from "./devices-list-skeleton";

export const DevicesSettings = async () => {
  const t = await getTranslations("core.auth.settings.devices");

  return (
    <>
      <HeaderContent desc={t("desc")} h2={t("title")} />

      <React.Suspense fallback={<DevicesListSkeleton />}>
        <DevicesList />
      </React.Suspense>
    </>
  );
};
