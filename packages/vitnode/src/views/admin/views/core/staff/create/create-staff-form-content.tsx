"use client";

import { ShieldIcon, UserIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  AdminUserOption,
  AdminUserSearchOptions,
} from "@/views/admin/views/core/users/list/users-query";
import type {
  AdminRoleOption,
  AdminRoleSearch,
} from "@/views/admin/views/core/users/roles/roles-query";

import { Avatar } from "@/components/avatar";
import { AsyncPicker } from "@/components/form/common/async-picker";
import { resolveRoleName } from "@/components/role-name";
import { Button } from "@/components/ui/button";

import { SelectableCard } from "../selectable-card";

export interface CreateStaffFormProps {
  /** Performs the write. Exactly one of `roleId`/`userId` is ever set. */
  onCreate: (args: {
    roleId?: number;
    type: PermissionStaffType;
    userId?: number;
  }) => Promise<AdminMutationResult<{ id: number }>>;
  /** Where a created entry is opened. Given the new entry's id. */
  onCreated: (id: number) => void;
  searchRoles: AdminRoleSearch;
  searchUsers: AdminUserSearchOptions;
  type: PermissionStaffType;
}

export const CreateStaffFormContent = ({
  onCreate,
  onCreated,
  searchRoles,
  searchUsers,
  type,
}: CreateStaffFormProps) => {
  const t = useTranslations("admin.staff.create");
  const locale = useLocale();
  const [target, setTarget] = React.useState<"role" | "user">("role");
  const [role, setRole] = React.useState<AdminRoleOption | null>(null);
  const [user, setUser] = React.useState<AdminUserOption | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const canSubmit = target === "role" ? Boolean(role) : Boolean(user);

  const onSubmit = async () => {
    const payload =
      target === "role"
        ? role && { roleId: role.id }
        : user && { userId: user.id };
    if (!payload) return;

    setIsLoading(true);
    const result = await onCreate({ type, ...payload });

    if ("error" in result) {
      setIsLoading(false);
      // `409` is the one refusal with a cause worth naming: that role or user is
      // already in this staff group, and the fix is to edit the existing entry.
      toast.error(
        result.error.status === 409 ? t("already_exists") : t("error"),
      );

      return;
    }

    toast.success(t("success"));
    onCreated(result.data.id);
  };

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
            onSelect={() => {
              setTarget("role");
            }}
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
            onSelect={() => {
              setTarget("user");
            }}
            selected={target === "user"}
            title={t("tabs.user")}
          />
        </div>
      </div>

      <div className="space-y-2">
        {target === "role" ? (
          <AsyncPicker<AdminRoleOption>
            onSelect={setRole}
            renderOption={item => (
              <span
                className="truncate font-medium"
                style={item.color ? { color: item.color } : undefined}
              >
                {resolveRoleName(item, locale)}
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
                  {resolveRoleName(role, locale)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("select_role")}
                </span>
              )
            }
          />
        ) : (
          <AsyncPicker<AdminUserOption>
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
