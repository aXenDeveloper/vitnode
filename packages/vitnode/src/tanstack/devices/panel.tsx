import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { PageTitle } from "@/components/ui/page-title";
import { DevicesContent } from "@/views/auth/settings/devices/devices-content";
import { DevicesListSkeleton } from "@/views/auth/settings/devices/devices-list-skeleton";
import { devicesQueryOptions } from "@/views/auth/settings/devices/devices-query";

import { useRevokeDeviceCallback } from "./query";

const DevicesHeading = () => {
  const t = useTranslations("core.auth.settings.devices");

  return <PageTitle desc={t("desc")} h2={t("title")} />;
};

export const DevicesPanelPending = () => (
  <>
    <DevicesHeading />
    <DevicesListSkeleton />
  </>
);

export const DevicesPanelContent = ({ userId }: { userId: number }) => {
  const { data } = useSuspenseQuery(devicesQueryOptions({ userId }));
  const onRevoke = useRevokeDeviceCallback(userId);

  return (
    <>
      <DevicesHeading />
      <DevicesContent devices={data.devices} onRevoke={onRevoke} />
    </>
  );
};
