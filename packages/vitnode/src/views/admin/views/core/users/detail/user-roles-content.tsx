"use client";

import {
  CheckIcon,
  ChevronsUpDownIcon,
  PencilIcon,
  PlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useLocale, useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  AdminRoleOption,
  AdminRoleSearch,
} from "@/views/admin/views/core/users/roles/roles-query";

import { RoleFormatContent } from "@/components/role-format-content";
import { resolveRoleName } from "@/components/role-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * A user's roles on the AdminCP detail page, with no framework in them.
 *
 * One primary role and any number of secondary ones. The dialog holds the
 * *complete* intended set and sends it as a replacement, matching the API - "add
 * these, remove those" would let two administrators editing at once produce a
 * set neither of them chose.
 */

export type UpdateAdminUserRoles = (
  id: number,
  input: { roleId: number; secondaryRoleIds: number[] },
) => Promise<AdminMutationResult<unknown>>;

/** A role as the card and the dialog both carry it. */
export interface UserRoleRef {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

const RolePicker = ({
  excludeIds = [],
  onRegister,
  onSelect,
  searchRoles,
  selectedIds,
  single = false,
  triggerContent,
  triggerRender,
}: {
  excludeIds?: number[];
  onRegister: (roles: AdminRoleOption[]) => void;
  onSelect: (role: AdminRoleOption) => void;
  searchRoles: AdminRoleSearch;
  selectedIds: number[];
  single?: boolean;
  triggerContent: React.ReactNode;
  triggerRender: React.ReactElement;
}) => {
  const t = useTranslations("core.global");
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<AdminRoleOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const runSearch = React.useCallback(
    async (value: string) => {
      setIsSearching(true);
      try {
        const results = await searchRoles(value);
        setOptions(results);
        onRegister(results);
      } finally {
        setIsSearching(false);
      }
    },
    [onRegister, searchRoles],
  );
  const debouncedSearch = useDebouncedCallback(runSearch, 400);

  const selectedSet = new Set(selectedIds);
  const excludeSet = new Set(excludeIds);
  const visibleOptions = options.filter(option => !excludeSet.has(option.id));

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
      <PopoverTrigger render={triggerRender}>{triggerContent}</PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-56 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={debouncedSearch}
            placeholder={t("search_placeholder")}
          />
          <CommandList>
            {isSearching && visibleOptions.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
                <CommandEmpty>{t("results_not_found")}</CommandEmpty>
                <CommandGroup>
                  {visibleOptions.map(role => (
                    <CommandItem
                      key={role.id}
                      onSelect={() => {
                        onSelect(role);
                        if (single) setOpen(false);
                      }}
                      value={String(role.id)}
                    >
                      <CheckIcon
                        className={cn(
                          "size-4 shrink-0",
                          selectedSet.has(role.id)
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <RoleFormatContent className="truncate" role={role} />
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
};

const EditRolesForm = ({
  id,
  onUpdateRoles,
  primaryRole,
  searchRoles,
  secondaryRoles,
}: {
  id: number;
  onUpdateRoles: UpdateAdminUserRoles;
  primaryRole: UserRoleRef;
  searchRoles: AdminRoleSearch;
  secondaryRoles: UserRoleRef[];
}) => {
  const t = useTranslations("admin.user.show");
  const tError = useTranslations("core.global.errors");
  const locale = useLocale();
  const { setIsDirty, setOpen } = useDialog();
  const [isPending, startTransition] = React.useTransition();

  const initialSecondaryIds = secondaryRoles.map(role => role.id);
  const [primaryId, setPrimaryId] = React.useState(primaryRole.id);
  const [secondaryIds, setSecondaryIds] =
    React.useState<number[]>(initialSecondaryIds);

  /**
   * Roles seen so far, by id.
   *
   * The picker returns a page at a time, so a role chosen ten searches ago has
   * to stay renderable in the badge list after the options have been replaced.
   */
  const [knownRoles, setKnownRoles] = React.useState<Map<number, UserRoleRef>>(
    () =>
      new Map(
        [primaryRole, ...secondaryRoles].map(role => [role.id, role] as const),
      ),
  );
  const registerRoles = React.useCallback((roles: AdminRoleOption[]) => {
    setKnownRoles(previous => {
      const next = new Map(previous);
      for (const role of roles) next.set(role.id, role);

      return next;
    });
  }, []);

  const markDirty = (nextPrimary: number, nextSecondary: number[]) => {
    setIsDirty?.(
      nextPrimary !== primaryRole.id ||
        nextSecondary.length !== initialSecondaryIds.length ||
        nextSecondary.some(roleId => !initialSecondaryIds.includes(roleId)),
    );
  };

  /** A role cannot be primary and secondary at once. */
  const selectPrimary = (role: AdminRoleOption) => {
    const nextSecondary = secondaryIds.filter(roleId => roleId !== role.id);
    setPrimaryId(role.id);
    setSecondaryIds(nextSecondary);
    markDirty(role.id, nextSecondary);
  };

  const toggleSecondary = (role: AdminRoleOption) => {
    const nextSecondary = secondaryIds.includes(role.id)
      ? secondaryIds.filter(roleId => roleId !== role.id)
      : [...secondaryIds, role.id];
    setSecondaryIds(nextSecondary);
    markDirty(primaryId, nextSecondary);
  };

  const onSubmit = () => {
    startTransition(async () => {
      const result = await onUpdateRoles(id, {
        roleId: primaryId,
        secondaryRoleIds: secondaryIds,
      });

      if ("error" in result) {
        toast.error(tError("title"), {
          description: tError("internal_server_error"),
        });

        return;
      }

      setIsDirty?.(false);
      setOpen?.(false);
      toast.success(t("updateSuccess"));
    });
  };

  const primary = knownRoles.get(primaryId);

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("primaryRole")}</span>
        <RolePicker
          onRegister={registerRoles}
          onSelect={selectPrimary}
          searchRoles={searchRoles}
          selectedIds={[primaryId]}
          single
          triggerContent={
            <>
              {primary ? (
                <RoleFormatContent className="truncate" role={primary} />
              ) : (
                <span className="text-muted-foreground">{t("selectRole")}</span>
              )}
              <ChevronsUpDownIcon className="ms-auto opacity-50" />
            </>
          }
          triggerRender={
            <Button
              className="w-full justify-start font-normal"
              variant="outline"
            />
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("secondaryRoles")}</span>
        {secondaryIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {secondaryIds.map(roleId => {
              const role = knownRoles.get(roleId);
              if (!role) return null;

              return (
                <Badge className="gap-1 pe-1" key={roleId} variant="secondary">
                  <span
                    className="truncate font-medium"
                    style={role.color ? { color: role.color } : undefined}
                  >
                    {resolveRoleName(role, locale)}
                  </span>
                  <Button
                    aria-label={t("removeRole")}
                    className="size-4"
                    onClick={() => {
                      const nextSecondary = secondaryIds.filter(
                        item => item !== roleId,
                      );
                      setSecondaryIds(nextSecondary);
                      markDirty(primaryId, nextSecondary);
                    }}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <XIcon />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}
        <RolePicker
          excludeIds={[primaryId]}
          onRegister={registerRoles}
          onSelect={toggleSecondary}
          searchRoles={searchRoles}
          selectedIds={secondaryIds}
          triggerContent={
            <>
              <PlusIcon />
              {t("addSecondaryRole")}
            </>
          }
          triggerRender={
            <Button
              className="w-fit border-dashed"
              size="sm"
              variant="outline"
            />
          }
        />
      </div>

      <DialogFooter>
        <Button isLoading={isPending} onClick={onSubmit} type="button">
          {t("saveRoles")}
        </Button>
      </DialogFooter>
    </>
  );
};

export const UserRolesCardContent = ({
  canEdit = true,
  id,
  onUpdateRoles,
  role,
  searchRoles,
  secondaryRoles,
}: {
  canEdit?: boolean;
  id: number;
  onUpdateRoles: UpdateAdminUserRoles;
  role: UserRoleRef;
  searchRoles: AdminRoleSearch;
  secondaryRoles: UserRoleRef[];
}) => {
  const t = useTranslations("admin.user.show");

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="text-muted-foreground size-5" />
          {t("rolesTitle")}
        </CardTitle>
        {canEdit && (
          <CardAction>
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    aria-label={t("editRoles")}
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <PencilIcon />
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UsersIcon className="size-5" />
                    {t("editRoles")}
                  </DialogTitle>
                  <DialogDescription>{t("editRolesDesc")}</DialogDescription>
                </DialogHeader>

                <EditRolesForm
                  id={id}
                  onUpdateRoles={onUpdateRoles}
                  primaryRole={role}
                  searchRoles={searchRoles}
                  secondaryRoles={secondaryRoles}
                />
              </DialogContent>
            </Dialog>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">
            {t("primaryRole")}
          </span>
          <RoleFormatContent role={role} />
        </div>

        {secondaryRoles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">
              {t("secondaryRoles")}
            </span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {secondaryRoles.map(item => (
                <RoleFormatContent key={item.id} role={item} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
