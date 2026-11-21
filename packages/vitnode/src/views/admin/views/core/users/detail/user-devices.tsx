import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListIcon, MonitorSmartphoneIcon, RotateCwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

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
import { DeviceRow, SignOutAllButton, useDeviceName } from "./user-device-row";
import { DetailFrame } from "./user-profile-cards";

const VISIBLE_DEVICES = 3;

const UserDevicesSheetContent = React.lazy(async () => ({
  default: (await import("./user-devices-sheet")).UserDevicesSheetContent,
}));

const SheetPending = () => {
  const t = useTranslations("admin.user.show.devices");

  return (
    <div aria-busy="true" className="flex flex-col gap-4 p-4">
      <span className="sr-only" role="status">
        {t("title")}
      </span>
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton className="h-10 w-full" key={index} />
      ))}
    </div>
  );
};

const DeviceList = ({
  canEdit,
  devices,
  onRevoke,
  onSignOutAll,
  userName,
}: {
  canEdit: boolean;
  devices: AdminUserDevice[];
  onRevoke: (device: AdminUserDevice) => Promise<void>;
  onSignOutAll: () => Promise<boolean>;
  userName: string;
}) => {
  const t = useTranslations("admin.user.show.devices");

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {devices.slice(0, VISIBLE_DEVICES).map(device => (
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
        <Sheet>
          <SheetTrigger
            render={<Button className="w-full" size="sm" variant="ghost" />}
          >
            <ListIcon aria-hidden="true" />
            {t("manageAll", { count: devices.length })}
          </SheetTrigger>
          <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
            <React.Suspense fallback={<SheetPending />}>
              <UserDevicesSheetContent
                canEdit={canEdit}
                devices={devices}
                onRevoke={onRevoke}
                onSignOutAll={onSignOutAll}
                userName={userName}
              />
            </React.Suspense>
          </SheetContent>
        </Sheet>
      )}
    </div>
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
  const tError = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const deviceName = useDeviceName();
  const showFailure = useFailureToast();
  const key = { adminUserId, userId: user.id };
  const {
    data: devices,
    isError,
    isFetching,
    isPending,
    refetch,
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
    <DetailFrame
      action={
        canEdit && devices && devices.length > 0 ? (
          <SignOutAllButton
            count={devices.length}
            onSignOutAll={signOutAll}
            userName={user.name}
          />
        ) : null
      }
      icon={MonitorSmartphoneIcon}
      title={t("title")}
    >
      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <Empty className="md:p-6" role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MonitorSmartphoneIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("loadError.title")}</EmptyTitle>
            <EmptyDescription>{t("loadError.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              isLoading={isFetching}
              onClick={() => {
                void refetch();
              }}
              size="sm"
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {tError("try_again")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : devices.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("empty")}
        </p>
      ) : (
        <DeviceList
          canEdit={canEdit}
          devices={devices}
          onRevoke={revokeDevice}
          onSignOutAll={signOutAll}
          userName={user.name}
        />
      )}
    </DetailFrame>
  );
};
