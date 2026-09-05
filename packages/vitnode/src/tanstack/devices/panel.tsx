"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { HeaderContent } from "@/components/ui/header-content";
import { DevicesContent } from "@/views/auth/settings/devices/devices-content";
import { DevicesListSkeleton } from "@/views/auth/settings/devices/devices-list-skeleton";

import { devicesQuery, useRevokeDeviceCallback } from "./query";

const DevicesHeading = () => {
  const t = useTranslations("core.auth.settings.devices");

  return <HeaderContent desc={t("desc")} h2={t("title")} />;
};

export const DevicesPanelPending = () => (
  <>
    <DevicesHeading />
    <DevicesListSkeleton />
  </>
);

export const DevicesPanelContent = ({ userId }: { userId: number }) => {
  const { data } = useSuspenseQuery(devicesQuery(userId));
  const onRevoke = useRevokeDeviceCallback(userId);

  return (
    <>
      <DevicesHeading />

      {/*
        The same component the Next.js page renders, handed the two things a
        shared list cannot resolve for itself: the devices, and the revoke.

        The revoke goes straight from the browser to Hono - no server function in
        between, because it needs no server-only secret and sets no cookie - and
        ends in an invalidation of the one `devices/me` entry, but only when the
        list is actually wrong. A `429` or a `401` left it exactly as it was, and
        refetching would send the same read back into whatever refused the first.
      */}
      <DevicesContent devices={data.devices} onRevoke={onRevoke} />
    </>
  );
};
