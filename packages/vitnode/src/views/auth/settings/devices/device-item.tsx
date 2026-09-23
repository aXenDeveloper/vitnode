import { cn } from "cn";
import { MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";

import type { Device } from "./devices-query";
import type { RevokeDevice } from "./devices-revoke";

import { SETTINGS_ROW } from "../settings-group";
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

  const facts = [
    {
      label: t("last_active"),
      value: device.isCurrent ? (
        <>
          <span
            aria-hidden="true"
            className="bg-success me-1.5 inline-block size-1.5 rounded-full align-middle"
          />
          {t("active_now")}
        </>
      ) : (
        <DateFormat date={device.lastSeen} />
      ),
    },
    {
      label: t("ip_address"),
      value: <span className="tabular-nums">{device.ipAddress}</span>,
    },
    {
      label: t("session_expires"),
      value: <DateFormat date={device.expiresAt} />,
    },
  ];

  return (
    <li className={cn(SETTINGS_ROW, "items-start")}>
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          device.isCurrent
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-foreground text-sm font-medium wrap-anywhere">
          {t("browser_on_os", { browser: device.browser, os: device.os })}
        </span>
        <dl className="flex flex-col gap-1 text-sm sm:grid sm:grid-cols-3 sm:gap-x-6">
          {facts.map(({ label, value }) => (
            <div
              className="flex min-w-0 gap-3 sm:flex-col sm:gap-0.5"
              key={label}
            >
              <dt className="text-muted-foreground w-28 shrink-0 sm:w-auto">
                {label}
              </dt>
              <dd className="text-foreground min-w-0 wrap-anywhere">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/*
        No button on the current device, because the API refuses to revoke it -
        `DELETE /users/devices/{publicId}` answers 400 for the id matching the
        requester's own device cookie. Offering it would put a refusal behind a
        button whose only outcome is an error toast.
      */}
      {isRevokableDevice(device) ? (
        <RevokeDeviceButton
          onRevoke={onRevoke}
          os={device.os}
          publicId={device.publicId}
        />
      ) : (
        <span aria-hidden="true" className="size-8 shrink-0" />
      )}
    </li>
  );
};
