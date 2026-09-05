"use client";

import { useTranslations } from "use-intl";

import type { Device } from "./devices-query";
import type { RevokeDevice } from "./devices-revoke";

import { DeviceItem } from "./device-item";

export const DevicesContent = ({
  devices,
  onRevoke,
}: {
  devices: Device[];
  onRevoke: RevokeDevice;
}) => {
  const t = useTranslations("core.auth.settings.devices");

  if (devices.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {devices.map(device => (
        <DeviceItem device={device} key={device.publicId} onRevoke={onRevoke} />
      ))}
    </div>
  );
};
