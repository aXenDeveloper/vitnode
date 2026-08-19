import { getTranslations } from "next-intl/server";

import { getDevicesApi } from "@/lib/api/get-devices-api";

import { DeviceItem } from "./device-item";

export const DevicesList = async () => {
  const [t, { devices }] = await Promise.all([
    getTranslations("core.auth.settings.devices"),
    getDevicesApi(),
  ]);

  if (devices.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  return (
    <div className="space-y-4">
      {devices.map(device => (
        <DeviceItem key={device.publicId} {...device} />
      ))}
    </div>
  );
};
