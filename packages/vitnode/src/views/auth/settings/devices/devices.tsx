import { getTranslations } from "next-intl/server";

import { HeaderContent } from "@/components/ui/header-content";
import { getDevicesApi } from "@/lib/api/get-devices-api";

import { DeviceItem } from "./device-item";

export const DevicesSettings = async () => {
  const t = await getTranslations("core.auth.settings.devices");
  const { devices } = await getDevicesApi();

  return (
    <>
      <HeaderContent desc={t("desc")} h2={t("title")} />

      {devices.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          {devices.map(device => (
            <DeviceItem key={device.publicId} {...device} />
          ))}
        </div>
      )}
    </>
  );
};
