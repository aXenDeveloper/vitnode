"use client";

import { MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type { Device } from "./devices-query";
import type { RevokeDevice } from "./devices-revoke";

import { isRevokableDevice } from "./devices-revoke";
import { RevokeDeviceButton } from "./revoke-device-button";

const icons = {
  desktop: MonitorIcon,
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
} as const;

export const DeviceItem = ({
  device,
  onRevoke,
}: {
  device: Device;
  onRevoke: RevokeDevice;
}) => {
  const t = useTranslations("core.auth.settings.devices");
  const Icon = icons[device.deviceType];

  const details = [
    { label: t("browser"), value: device.browser },
    { label: t("ip_address"), value: device.ipAddress },
    {
      label: t("session_expires"),
      value: <DateFormat date={device.expiresAt} showFullDate />,
    },
  ];

  return (
    <div className="rounded-lg border p-4 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{device.os}</span>
            {device.isCurrent && <Badge>{t("current_device")}</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">
            {t("last_active")}: <DateFormat date={device.lastSeen} />
          </p>
        </div>

        {/*
          No button on the current device, because the API refuses to revoke it -
          `DELETE /users/devices/{publicId}` answers 400 for the id matching the
          requester's own device cookie. Offering it would put a refusal behind a
          button whose only outcome is an error toast.
        */}
        {isRevokableDevice(device) && (
          <RevokeDeviceButton
            onRevoke={onRevoke}
            os={device.os}
            publicId={device.publicId}
          />
        )}
      </div>

      <Separator className="my-4" />

      <dl className="grid gap-2 text-sm">
        {details.map(({ label, value }) => (
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]" key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
