"use client";

import { ChevronsUpDownIcon } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/lib/navigation";

import type { Role } from "../../users/show/roles/search-roles.action";
import type { StaffUserOption } from "./search.action";

import { searchRolesForUser } from "../../users/show/roles/search-roles.action";
import { createStaffEntry } from "./mutation-api";
import { searchUsersForStaff } from "./search.action";

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
    const payload =
      target === "role"
        ? role
          ? { roleId: role.id }
          : null
        : user
          ? { userId: user.id }
          : null;
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
    <div className="max-w-lg space-y-4">
      <span className="text-sm font-medium">{t("assign_to")}</span>

      <Tabs
        onValueChange={value => setTarget(value as "role" | "user")}
        value={target}
      >
        <TabsList>
          <TabsTrigger value="role">{t("tabs.role")}</TabsTrigger>
          <TabsTrigger value="user">{t("tabs.user")}</TabsTrigger>
        </TabsList>

        <TabsContent value="role">
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
        </TabsContent>

        <TabsContent value="user">
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
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button disabled={!canSubmit} isLoading={isLoading} onClick={onSubmit}>
          {t("submit")}
        </Button>
      </div>
    </div>
  );
};
