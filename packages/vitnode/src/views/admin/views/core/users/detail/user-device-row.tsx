import {
  LaptopIcon,
  LogOutIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { AdminUserDevice } from "./user-account-query";

const DEVICE_ICONS = {
  desktop: LaptopIcon,
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
};

const known = (value: null | string) =>
  value && value !== "Unknown" ? value : null;

export const useDeviceName = () => {
  const t = useTranslations("admin.user.show.devices");

  return (device: AdminUserDevice) => {
    const browser = known(device.browser);
    const os = known(device.os);

    return browser && os
      ? t("deviceName", { browser, os })
      : (browser ?? os ?? t("unknownDevice"));
  };
};

const RevokeDeviceButton = ({
  device,
  onRevoke,
  userName,
}: {
  device: AdminUserDevice;
  onRevoke: () => Promise<void>;
  userName: string;
}) => {
  const t = useTranslations("admin.user.show.devices");
  const deviceName = useDeviceName()(device);
  const label = t("signOutLabel", { device: deviceName });

  return (
    <Tooltip>
      <ConfirmActionAlertDialog
        description={t("signOutDesc", { device: deviceName, name: userName })}
        icon={<LogOutIcon />}
        onSubmit={async ({ onClose }) => {
          await onRevoke();
          onClose();
        }}
        textSubmit={t("signOutSubmit")}
        title={t("signOutTitle")}
      >
        <TooltipTrigger
          render={<Button aria-label={label} size="icon-sm" variant="ghost" />}
        >
          <LogOutIcon />
        </TooltipTrigger>
      </ConfirmActionAlertDialog>
      <TooltipContent>{t("signOut")}</TooltipContent>
    </Tooltip>
  );
};

export const DeviceRow = ({
  canEdit,
  device,
  onRevoke,
  userName,
}: {
  canEdit: boolean;
  device: AdminUserDevice;
  onRevoke: () => Promise<void>;
  userName: string;
}) => {
  const t = useTranslations("admin.user.show.devices");
  const deviceName = useDeviceName();
  const Icon = DEVICE_ICONS[device.deviceType];

  return (
    <li className="flex items-center gap-3">
      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate font-medium">
            {deviceName(device)}
          </span>
          {device.sessionKinds.includes("admin") && (
            <Badge variant="secondary">{t("admincp")}</Badge>
          )}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          <span className="tabular-nums">{device.ipAddress}</span>
          {" · "}
          <DateFormat date={device.lastSeen} />
        </span>
      </div>
      {canEdit && (
        <RevokeDeviceButton
          device={device}
          onRevoke={onRevoke}
          userName={userName}
        />
      )}
    </li>
  );
};

export const SignOutAllButton = ({
  count,
  onSignOutAll,
  userName,
}: {
  count: number;
  onSignOutAll: () => Promise<boolean>;
  userName: string;
}) => {
  const t = useTranslations("admin.user.show.devices");

  return (
    <ConfirmActionAlertDialog
      description={t("signOutAllDesc", { count })}
      icon={<LogOutIcon />}
      onSubmit={async ({ onClose }) => {
        if (await onSignOutAll()) onClose();
      }}
      textSubmit={t("signOutAll")}
      title={t("signOutAllTitle", { name: userName })}
    >
      <Button size="xs" variant="outline">
        <LogOutIcon />
        {t("signOutAll")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};
