import { cn } from "cn";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";

import type { Device } from "./devices-query";
import type { RevokeDevice } from "./devices-revoke";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";
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

  const current = devices.filter(device => device.isCurrent);
  const others = devices.filter(device => !device.isCurrent);

  return (
    <>
      {current.length === 0 ? null : (
        <SettingsGroup title={t("current_device")}>
          {current.map(device => (
            <DeviceItem
              device={device}
              key={device.publicId}
              onRevoke={onRevoke}
            />
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup
        footer={others.length === 0 ? undefined : t("others_desc")}
        title={
          <span className="flex items-center gap-2">
            {t("other_devices")}
            {others.length === 0 ? null : (
              <Badge className="tabular-nums" variant="secondary">
                {others.length}
              </Badge>
            )}
          </span>
        }
      >
        {others.length === 0 ? (
          <li className={cn(SETTINGS_ROW, "text-muted-foreground text-sm")}>
            {t("others_empty")}
          </li>
        ) : (
          others.map(device => (
            <DeviceItem
              device={device}
              key={device.publicId}
              onRevoke={onRevoke}
            />
          ))
        )}
      </SettingsGroup>
    </>
  );
};
