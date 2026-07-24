"use client";

import { ChevronsUpDownIcon, ShieldIcon, UserIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/lib/navigation";

import type { Role } from "../../users/show/roles/search-roles.action.server";
import type { StaffUserOption } from "./search.action.server";

import { searchRolesForUser } from "../../users/show/roles/search-roles.action.server";
import { SelectableCard } from "../selectable-card";
import { createStaffEntry } from "./mutation-api.server";
import { searchUsersForStaff } from "./search.action.server";

const roleName = (role: Role, locale: string) =>
  role.name.find(item => item.languageCode === locale)?.name ??
  role.name[0]?.name ??
  "";

function EntityPicker<T>({
  search,
  getKey,
  renderItem,
  placeholder,
  onSelect,
  trigger,
}: {
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  placeholder: string;
  renderItem: (item: T) => React.ReactNode;
  search: (value: string) => Promise<T[]>;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("core.global");
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<T[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const runSearch = React.useCallback(
    async (value: string) => {
      setIsSearching(true);
      try {
        setOptions(await search(value));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setOptions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [search],
  );
  const debouncedSearch = useDebouncedCallback(runSearch, 400);

  return (
    <Popover
      onOpenChange={next => {
        setOpen(next);
        if (next) {
          setOptions([]);
          void runSearch("");
        }
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-start font-normal"
            variant="outline"
          />
        }
      >
        {trigger}
        <ChevronsUpDownIcon className="ms-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-56 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={debouncedSearch}
            placeholder={placeholder}
          />
          <CommandList>
            {isSearching && options.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
                <CommandEmpty>{t("results_not_found")}</CommandEmpty>
                <CommandGroup>
                  {options.map(item => (
                    <CommandItem
                      key={getKey(item)}
                      onSelect={() => {
                        onSelect(item);
                        setOpen(false);
                      }}
                      value={getKey(item)}
                    >
                      {renderItem(item)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const CreateStaffPermissionsForm = ({
  type,
}: {
  type: PermissionStaffType;
}) => {
  const t = useTranslations("admin.staff.create");
  const locale = useLocale();
  const router = useRouter();
  const [target, setTarget] = React.useState<"role" | "user">("role");
  const [role, setRole] = React.useState<null | Role>(null);
  const [user, setUser] = React.useState<null | StaffUserOption>(null);
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
          <EntityPicker<Role>
            getKey={item => String(item.id)}
            onSelect={setRole}
            placeholder={t("select_role")}
            renderItem={item => (
              <span
                className="truncate font-medium"
                style={item.color ? { color: item.color } : undefined}
              >
                {roleName(item, locale)}
              </span>
            )}
            search={searchRolesForUser}
            trigger={
              role ? (
                <span
                  className="truncate font-medium"
                  style={role.color ? { color: role.color } : undefined}
                >
                  {roleName(role, locale)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("select_role")}
                </span>
              )
            }
          />
        ) : (
          <EntityPicker<StaffUserOption>
            getKey={item => String(item.id)}
            onSelect={setUser}
            placeholder={t("search_user")}
            renderItem={item => (
              <div className="flex items-center gap-2">
                <Avatar size={24} user={item} />
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground text-sm">
                  @{item.nameCode}
                </span>
              </div>
            )}
            search={searchUsersForStaff}
            trigger={
              user ? (
                <span className="flex items-center gap-2">
                  <Avatar size={20} user={user} />
                  {user.name}
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
