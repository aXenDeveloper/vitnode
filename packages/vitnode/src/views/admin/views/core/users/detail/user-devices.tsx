import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LaptopIcon,
  LogOutIcon,
  MonitorSmartphoneIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { AdminUserDevice } from "./user-account-query";
import type { AdminUserDetail } from "./user-query";

import { useFailureToast } from "./use-failure-toast";
import {
  revokeAdminUserDevice,
  revokeAdminUserDevices,
} from "./user-account-mutations";
import {
  adminUserDevicesQueryKey,
  adminUserDevicesQueryOptions,
} from "./user-account-query";
import { DetailCardTitle } from "./user-profile-cards";

const VISIBLE_DEVICES = 3;

const DEVICE_ICONS = {
  desktop: LaptopIcon,
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
};

const useDeviceName = () => {
  const t = useTranslations("admin.user.show.devices");

  return (device: AdminUserDevice) =>
    device.browser && device.os
      ? t("deviceName", { browser: device.browser, os: device.os })
      : (device.browser ?? device.os ?? t("unknownDevice"));
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

const DeviceRow = ({
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

const SignOutAllButton = ({
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

const DeviceList = ({
  canEdit,
  devices,
  onRevoke,
  userName,
}: {
  canEdit: boolean;
  devices: AdminUserDevice[];
  onRevoke: (device: AdminUserDevice) => Promise<void>;
  userName: string;
}) => {
  const t = useTranslations("admin.user.show.devices");
  const [showAll, setShowAll] = React.useState(false);

  return (
    <>
      <ul className="flex flex-col gap-3">
        {(showAll ? devices : devices.slice(0, VISIBLE_DEVICES)).map(device => (
          <DeviceRow
            canEdit={canEdit}
            device={device}
            key={device.publicId}
            onRevoke={async () => {
              await onRevoke(device);
            }}
            userName={userName}
          />
        ))}
      </ul>
      {devices.length > VISIBLE_DEVICES && (
        <Button
          className="mt-3 w-full"
          onClick={() => {
            setShowAll(value => !value);
          }}
          size="sm"
          variant="ghost"
        >
          {showAll ? t("showFewer") : t("showAll", { count: devices.length })}
        </Button>
      )}
    </>
  );
};

export const UserDevicesCard = ({
  adminUserId,
  canEdit,
  user,
}: {
  adminUserId: AdminIdentity;
  canEdit: boolean;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.devices");
  const queryClient = useQueryClient();
  const deviceName = useDeviceName();
  const showFailure = useFailureToast();
  const key = { adminUserId, userId: user.id };
  const {
    data: devices,
    isError,
    isPending,
  } = useQuery(adminUserDevicesQueryOptions(key));

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminUserDevicesQueryKey(key),
    });
  };

  const revokeDevice = async (device: AdminUserDevice) => {
    const result = await revokeAdminUserDevice(user.id, device.publicId);
    if ("error" in result) {
      showFailure();

      return;
    }
    await refresh();
    toast.success(t("signedOut"), {
      description: t("signedOutDesc", { device: deviceName(device) }),
    });
  };

  const signOutAll = async () => {
    const result = await revokeAdminUserDevices(user.id);
    if ("error" in result) {
      showFailure();

      return false;
    }
    await refresh();
    toast.success(t("signedOutAll"), {
      description: t("signedOutAllDesc", { name: user.name }),
    });

    return true;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <DetailCardTitle icon={MonitorSmartphoneIcon}>
          {t("title")}
        </DetailCardTitle>
        {canEdit && devices && devices.length > 0 && (
          <CardAction>
            <SignOutAllButton
              count={devices.length}
              onSignOutAll={signOutAll}
              userName={user.name}
            />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("loadError")}
          </p>
        ) : devices.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("empty")}
          </p>
        ) : (
          <DeviceList
            canEdit={canEdit}
            devices={devices}
            onRevoke={revokeDevice}
            userName={user.name}
          />
        )}
      </CardContent>
    </Card>
  );
};
