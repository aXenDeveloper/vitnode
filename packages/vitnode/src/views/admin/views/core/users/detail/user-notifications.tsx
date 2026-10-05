import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { NotificationPreferenceTypeView } from "@/views/notifications/notifications-query";

import { Skeleton } from "@/components/ui/skeleton";
import { NotificationTypeItem } from "@/views/notifications/settings/type-item";

import type { AdminUserNotificationPatch } from "./user-account-mutations";
import type { AdminUserDetail } from "./user-query";

import { updateAdminUserNotificationPreferences } from "./user-account-mutations";
import {
  adminUserNotificationsQueryKey,
  adminUserNotificationsQueryOptions,
} from "./user-account-query";

interface NotificationGroup {
  label: string;
  types: NotificationPreferenceTypeView[];
}

export const groupNotificationTypes = (
  types: NotificationPreferenceTypeView[],
): NotificationGroup[] => [
  ...types
    .reduce((map, type) => {
      const group = map.get(type.category) ?? {
        label: type.categoryLabel,
        types: [],
      };
      group.types.push(type);

      return map.set(type.category, group);
    }, new Map<string, NotificationGroup>())
    .values(),
];

export const UserNotificationsPanel = ({
  adminUserId,
  canEdit,
  user,
}: {
  adminUserId: AdminIdentity;
  canEdit: boolean;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.notifications");
  const tError = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const key = { adminUserId, userId: user.id };
  const queryKey = adminUserNotificationsQueryKey(key);
  const { data, isError, isPending } = useQuery(
    adminUserNotificationsQueryOptions(key),
  );
  const [openId, setOpenId] = React.useState<null | string>(null);

  const save = async (typeId: string, patch: AdminUserNotificationPatch) => {
    const previous =
      queryClient.getQueryData<NotificationPreferenceTypeView[]>(queryKey);
    queryClient.setQueryData<NotificationPreferenceTypeView[]>(
      queryKey,
      current =>
        current?.map(type =>
          type.id === typeId
            ? { ...type, value: { ...type.value, ...patch } }
            : type,
        ),
    );

    const result = await updateAdminUserNotificationPreferences(user.id, {
      [typeId]: patch,
    });

    if ("error" in result) {
      queryClient.setQueryData(queryKey, previous);
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    queryClient.setQueryData(queryKey, result.data);
    toast.success(t("saved"), {
      description: t("savedDesc", { name: user.name }),
    });
  };

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("loadError")}
      </p>
    );
  }

  const groups = groupNotificationTypes(data);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("desc", { name: user.name })}
      </p>
      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="bg-card ring-foreground/10 overflow-hidden rounded-md shadow-xs ring-1">
          {groups.map(group => (
            <React.Fragment key={group.label}>
              {groups.length > 1 ? (
                <li className="bg-muted/40 text-muted-foreground border-b px-4 py-2 text-xs font-medium">
                  <h3>{group.label}</h3>
                </li>
              ) : null}
              {group.types.map(type => (
                <NotificationTypeItem
                  isOpen={openId === type.id}
                  key={type.id}
                  onChange={patch => {
                    if (!canEdit) return;
                    void save(type.id, patch);
                  }}
                  onToggle={() => {
                    setOpenId(current =>
                      current === type.id ? null : type.id,
                    );
                  }}
                  type={canEdit ? type : { ...type, locked: true }}
                />
              ))}
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  );
};
