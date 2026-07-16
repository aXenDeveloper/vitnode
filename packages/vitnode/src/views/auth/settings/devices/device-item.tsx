import { MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { DevicesApi } from "@/lib/api/get-devices-api";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { RevokeDeviceButton } from "./revoke-device-button";

type Device = DevicesApi["devices"][number];

const icons = {
  desktop: MonitorIcon,
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
} as const;

export const DeviceItem = async ({
  browser,
  deviceType,
  expiresAt,
  ipAddress,
  isCurrent,
  lastSeen,
  os,
  publicId,
}: Device) => {
  const t = await getTranslations("core.auth.settings.devices");
  const Icon = icons[deviceType];

  const details = [
    { label: t("browser"), value: browser },
    { label: t("ip_address"), value: ipAddress },
    {
      label: t("session_expires"),
      value: <DateFormat date={expiresAt} showFullDate />,
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
            <span className="font-semibold">{os}</span>
            {isCurrent && <Badge>{t("current_device")}</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">
            {t("last_active")}: <DateFormat date={lastSeen} />
          </p>
        </div>

        {!isCurrent && <RevokeDeviceButton os={os} publicId={publicId} />}
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
