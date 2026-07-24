"use client";

import { CheckIcon, ChevronsUpDownIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { TooltipWithContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { RoleOption } from "./search-roles.action.server";

import { deleteRole } from "./delete-role.action.server";
import { searchRolesForMove } from "./search-roles.action.server";

const useRoleName = () => {
  const locale = useLocale();

  return (role: RoleOption) =>
    role.name.find(item => item.languageCode === locale)?.name ??
    role.name[0]?.name ??
    "";
};

const RoleName = ({ role }: { role: RoleOption }) => {
  const resolveName = useRoleName();

  return (
    <span
      className="truncate font-medium"
      style={role.color ? { color: role.color } : undefined}
    >
      {resolveName(role)}
    </span>
  );
};

const MoveRolePicker = ({
  excludeId,
  onSelect,
  value,
}: {
  excludeId: number;
  onSelect: (role: RoleOption) => void;
  value: null | RoleOption;
}) => {
  const t = useTranslations("core.global");
  const tRole = useTranslations("admin.role.delete");
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<RoleOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const runSearch = React.useCallback(async (search: string) => {
    setIsSearching(true);
    try {
      setOptions(await searchRolesForMove(search));
    } finally {
      setIsSearching(false);
    }
  }, []);
  const debouncedSearch = useDebouncedCallback(runSearch, 400);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setOptions([]);
      void runSearch("");
    }
  };

  const visibleOptions = options.filter(option => option.id !== excludeId);

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-start font-normal"
            variant="outline"
          />
        }
      >
        {value ? (
          <RoleName role={value} />
        ) : (
          <span className="text-muted-foreground">{tRole("selectRole")}</span>
        )}
        <ChevronsUpDownIcon className="ms-auto opacity-50" />
      </PopoverTrigger>
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
                        setOpen(false);
                      }}
                      value={String(role.id)}
                    >
                      <CheckIcon
                        className={cn(
                          "size-4 shrink-0",
                          value?.id === role.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <RoleName role={role} />
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

export const DeleteAction = ({
  data,
}: {
  data: {
    color: null | string;
    id: number;
    name: { languageCode: string; name: string }[];
    usersCount: number;
  };
}) => {
  const t = useTranslations("admin.role.delete");
  const tError = useTranslations("core.global.errors");
  const resolveName = useRoleName();
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState<null | RoleOption>(null);
  const [isPending, startTransition] = React.useTransition();

  const hasUsers = data.usersCount > 0;
  const roleName = resolveName(data);
  const canSubmit = !hasUsers || target != null;

  const onConfirm = () => {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => {
      const result = await deleteRole({
        id: data.id,
        moveToRoleId: hasUsers ? target?.id : undefined,
      });

      if (result.error) {
        toast.error(tError("title"), {
          description: tError("internal_server_error"),
        });

        return;
      }

      toast.success(t("success"));
      setOpen(false);
    });
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <TooltipWithContent text={t("title")}>
        <AlertDialogTrigger
          render={
            <Button aria-label={t("title")} size="icon" variant="destructive" />
          }
        >
          <Trash2Icon />
        </AlertDialogTrigger>
      </TooltipWithContent>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasUsers
              ? t("descWithUsers", { count: data.usersCount, name: roleName })
              : t("desc", { name: roleName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasUsers && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("moveToLabel")}</span>
            <MoveRolePicker
              excludeId={data.id}
              onSelect={setTarget}
              value={target}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <Button
            disabled={!canSubmit}
            isLoading={isPending}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
