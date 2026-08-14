"use client";

import { ShieldIcon, UserIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { Avatar } from "@/components/avatar";
import { AsyncPicker } from "@/components/form/common/async-picker";
import { roleOptionName } from "@/components/form/fields/input-roles";
import {
  type RoleOption,
  searchRoles,
} from "@/components/form/fields/search-roles.action.server";
import {
  searchUsers,
  type UserOption,
} from "@/components/form/fields/search-users.action.server";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/navigation";

import { SelectableCard } from "../selectable-card";
import { createStaffEntry } from "./mutation-api.server";

export const CreateStaffPermissionsForm = ({
  type,
}: {
  type: PermissionStaffType;
}) => {
  const t = useTranslations("admin.staff.create");
  const locale = useLocale();
  const router = useRouter();
  const [target, setTarget] = React.useState<"role" | "user">("role");
  const [role, setRole] = React.useState<null | RoleOption>(null);
  const [user, setUser] = React.useState<null | UserOption>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const onSubmit = async () => {
    let payload: null | { roleId: number } | { userId: number } = null;
    if (target === "role") {
      if (role) payload = { roleId: role.id };
    } else {
      if (user) payload = { userId: user.id };
    }
    if (!payload) return;

    setIsLoading(true);
    const result = await createStaffEntry({ type, ...payload });

    if (result.error) {
      setIsLoading(false);
      toast.error(
        result.error.status === 409 ? t("already_exists") : t("error"),
      );

      return;
    }

    toast.success(t("success"));
    router.push(
      `/admin/core/staff/${
        type === "admin" ? "admins" : "moderators"
      }/edit/${result.data?.id}`,
    );
  };

  const canSubmit = target === "role" ? Boolean(role) : Boolean(user);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {t("assign_to")}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectableCard
            description={t("tabs.role_desc")}
            icon={
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <ShieldIcon className="size-5" />
              </span>
            }
            onSelect={() => setTarget("role")}
            selected={target === "role"}
            title={t("tabs.role")}
          />
          <SelectableCard
            description={t("tabs.user_desc")}
            icon={
              <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                <UserIcon className="size-5" />
              </span>
            }
            onSelect={() => setTarget("user")}
            selected={target === "user"}
            title={t("tabs.user")}
          />
        </div>
      </div>

      <div className="space-y-2">
        {target === "role" ? (
          <AsyncPicker<RoleOption>
            onSelect={setRole}
            renderOption={item => (
              <span
                className="truncate font-medium"
                style={item.color ? { color: item.color } : undefined}
              >
                {roleOptionName(item, locale)}
              </span>
            )}
            search={searchRoles}
            searchPlaceholder={t("select_role")}
            selectedIds={role ? [role.id] : []}
            trigger={
              role ? (
                <span
                  className="truncate font-medium"
                  style={role.color ? { color: role.color } : undefined}
                >
                  {roleOptionName(role, locale)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("select_role")}
                </span>
              )
            }
          />
        ) : (
          <AsyncPicker<UserOption>
            onSelect={setUser}
            renderOption={item => (
              <div className="flex min-w-0 items-center gap-2">
                <Avatar size={24} user={item} />
                <span className="truncate font-medium">{item.name}</span>
                <span className="text-muted-foreground truncate text-sm">
                  @{item.nameCode}
                </span>
              </div>
            )}
            search={searchUsers}
            searchPlaceholder={t("search_user")}
            selectedIds={user ? [user.id] : []}
            trigger={
              user ? (
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar size={20} user={user} />
                  <span className="truncate">{user.name}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("search_user")}
                </span>
              )
            }
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button disabled={!canSubmit} isLoading={isLoading} onClick={onSubmit}>
          {t("submit")}
        </Button>
      </div>
    </div>
  );
};
