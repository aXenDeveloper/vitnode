"use client";

import {
  CheckIcon,
  ChevronsUpDownIcon,
  PencilIcon,
  PlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

import { Badge } from "@/components/ui/badge";
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

import type { Role } from "./search-roles.action.server";

import { searchRolesForUser } from "./search-roles.action.server";
import { updateUserRoles } from "./update-roles.action.server";

const RoleName = ({ role }: { role: Role }) => {
  const locale = useLocale();
  const name =
    role.name.find(item => item.languageCode === locale)?.name ??
    role.name[0]?.name ??
    "";

  return (
    <span
      className="truncate font-medium"
      style={role.color ? { color: role.color } : undefined}
    >
      {name}
    </span>
  );
};

const RolePicker = ({
  excludeIds = [],
  onRegister,
  onSelect,
  selectedIds,
  single = false,
  triggerContent,
  triggerRender,
}: {
  excludeIds?: number[];
  onRegister: (roles: Role[]) => void;
  onSelect: (role: Role) => void;
  selectedIds: number[];
  single?: boolean;
  triggerContent: React.ReactNode;
  triggerRender: React.ReactElement;
}) => {
  const t = useTranslations("core.global");
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<Role[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const runSearch = React.useCallback(
    async (value: string) => {
      setIsSearching(true);
      try {
        const results = await searchRolesForUser(value);
        setOptions(results);
        onRegister(results);
      } finally {
        setIsSearching(false);
      }
    },
    [onRegister],
  );
  const debouncedSearch = useDebouncedCallback(runSearch, 400);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setOptions([]);
      void runSearch("");
    }
  };

  const selectedSet = new Set(selectedIds);
  const excludeSet = new Set(excludeIds);
  const visibleOptions = options.filter(option => !excludeSet.has(option.id));

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
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
                  {visibleOptions.map(role => {
                    const isSelected = selectedSet.has(role.id);

                    return (
                      <CommandItem
                        key={role.id}
                        onSelect={() => {
                          onSelect(role);
                          if (single) {
                            setOpen(false);
                          }
                        }}
                        value={String(role.id)}
                      >
                        <CheckIcon
                          className={cn(
                            "size-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <RoleName role={role} />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const FormEditRoles = ({
  id,
  primaryRole,
  secondaryRoles,
}: {
  id: number;
  primaryRole: Role;
  secondaryRoles: Role[];
}) => {
  const t = useTranslations("admin.user.show");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();
  const [isPending, startTransition] = React.useTransition();

  const initialSecondaryIds = secondaryRoles.map(role => role.id);
  const [primaryId, setPrimaryId] = React.useState(primaryRole.id);
  const [secondaryIds, setSecondaryIds] =
    React.useState<number[]>(initialSecondaryIds);

  const [knownRoles, setKnownRoles] = React.useState<Map<number, Role>>(
    () =>
      new Map(
        [primaryRole, ...secondaryRoles].map(role => [role.id, role] as const),
      ),
  );
  const registerRoles = React.useCallback((roles: Role[]) => {
    setKnownRoles(prev => {
      const next = new Map(prev);
      for (const role of roles) {
        next.set(role.id, role);
      }

      return next;
    });
  }, []);

  const markDirty = (nextPrimary: number, nextSecondary: number[]) => {
    const isDirty =
      nextPrimary !== primaryRole.id ||
      nextSecondary.length !== initialSecondaryIds.length ||
      nextSecondary.some(id => !initialSecondaryIds.includes(id));
    setIsDirty?.(isDirty);
  };

  const selectPrimary = (role: Role) => {
    setPrimaryId(role.id);
    const nextSecondary = secondaryIds.filter(id => id !== role.id);
    setSecondaryIds(nextSecondary);
    markDirty(role.id, nextSecondary);
  };

  const toggleSecondary = (role: Role) => {
    const nextSecondary = secondaryIds.includes(role.id)
      ? secondaryIds.filter(id => id !== role.id)
      : [...secondaryIds, role.id];
    setSecondaryIds(nextSecondary);
    markDirty(primaryId, nextSecondary);
  };

  const removeSecondary = (id: number) => {
    const nextSecondary = secondaryIds.filter(item => item !== id);
    setSecondaryIds(nextSecondary);
    markDirty(primaryId, nextSecondary);
  };

  const onSubmit = () => {
    startTransition(async () => {
      const result = await updateUserRoles(id, {
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
          selectedIds={[primaryId]}
          single
          triggerContent={
            <>
              {primary ? (
                <RoleName role={primary} />
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
            {secondaryIds.map(id => {
              const role = knownRoles.get(id);
              if (!role) return null;

              return (
                <Badge className="gap-1 pe-1" key={id} variant="secondary">
                  <RoleName role={role} />
                  <Button
                    aria-label={t("removeRole")}
                    className="size-4"
                    onClick={() => {
                      removeSecondary(id);
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

export const EditRoles = ({
  id,
  primaryRole,
  secondaryRoles,
}: {
  id: number;
  primaryRole: Role;
  secondaryRoles: Role[];
}) => {
  const t = useTranslations("admin.user.show");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button aria-label={t("editRoles")} size="icon-sm" variant="ghost" />
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

        <FormEditRoles
          id={id}
          primaryRole={primaryRole}
          secondaryRoles={secondaryRoles}
        />
      </DialogContent>
    </Dialog>
  );
};
