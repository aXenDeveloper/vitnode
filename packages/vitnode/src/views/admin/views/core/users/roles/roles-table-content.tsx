"use client";

import {
  ChevronsUpDownIcon,
  ExternalLink,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useLocale, useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { DateFormat } from "@/components/date-format";
import { RoleFormatContent } from "@/components/role-format-content";
import { resolveRoleName } from "@/components/role-name";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { ContentDataTable } from "@/components/table/content";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ADMIN_ROLE_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminRoleFormProps } from "./role-form-content";
import type {
  AdminRoleOption,
  AdminRoleRow,
  AdminRoleSearch,
  AdminRolesPage,
} from "./roles-query";

import { ADMIN_ROLES_DEFAULT_ORDER } from "./roles-query";

/**
 * The AdminCP roles table, with no framework in it.
 *
 * Columns, the members link, the edit dialog and the delete flow - lifted out of
 * the Next.js Server Component so a TanStack route renders the same screen. The
 * three writes and the role search arrive as props, because how a write ends
 * (revalidate a path, or invalidate a query key) is the application's question
 * rather than the table's.
 *
 * The form itself is loaded lazily, exactly as the Next.js version loads it with
 * `next/dynamic`: it drags `AutoForm`, the colour picker and the multi-language
 * inputs behind it, and none of that is worth downloading to look at a list.
 * `React.lazy` is the framework-neutral spelling of the same thing.
 */
const AdminRoleFormContent = React.lazy(async () =>
  import("./role-form-content").then(module => ({
    default: module.AdminRoleFormContent,
  })),
);

export interface RolesAdminTableProps {
  data: AdminRolesPage;
  LinkComponent: AuthLinkComponent;
  onDelete: (args: {
    id: number;
    moveToRoleId?: number;
  }) => Promise<AdminMutationResult<unknown>>;
  onSave: AdminRoleFormProps["onSave"];
  onSaved?: () => void;
  searchRoles: AdminRoleSearch;
}

/**
 * The role a deleted role's members are moved into.
 *
 * The role being deleted is excluded, because moving members into the role that
 * is about to stop existing is the one choice that cannot work.
 */
const MoveRolePicker = ({
  excludeId,
  onSelect,
  searchRoles,
  value,
}: {
  excludeId: number;
  onSelect: (role: AdminRoleOption) => void;
  searchRoles: AdminRoleSearch;
  value: AdminRoleOption | null;
}) => {
  const t = useTranslations("core.global");
  const tRole = useTranslations("admin.role.delete");
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<AdminRoleOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const runSearch = React.useCallback(
    async (search: string) => {
      setIsSearching(true);
      try {
        setOptions(await searchRoles(search));
      } finally {
        setIsSearching(false);
      }
    },
    [searchRoles],
  );
  const debouncedSearch = useDebouncedCallback(runSearch, 400);

  const visibleOptions = options.filter(option => option.id !== excludeId);

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
        {value ? (
          <RoleFormatContent className="truncate" role={value} />
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
                      <span
                        className={cn(
                          "size-4 shrink-0 rounded-full border",
                          value?.id === role.id
                            ? "bg-primary border-primary"
                            : "border-input",
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

/**
 * Deleting a role.
 *
 * A role with members cannot simply vanish - everybody needs a role - so the
 * dialog will not submit until a destination is chosen, and the toast says how
 * many people moved where. A role with no members skips all of it.
 */
const DeleteRoleAction = ({
  onDelete,
  onSaved,
  role,
  searchRoles,
}: {
  onDelete: RolesAdminTableProps["onDelete"];
  onSaved?: () => void;
  role: AdminRoleRow;
  searchRoles: AdminRoleSearch;
}) => {
  const t = useTranslations("admin.role.delete");
  const tError = useTranslations("core.global.errors");
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState<AdminRoleOption | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const hasUsers = role.usersCount > 0;
  const roleName = resolveRoleName(role, locale);
  const canSubmit = !hasUsers || target != null;

  const onConfirm = () => {
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await onDelete({
        id: role.id,
        moveToRoleId: hasUsers ? target?.id : undefined,
      });

      if ("error" in result) {
        toast.error(tError("title"), {
          description: tError("internal_server_error"),
        });

        return;
      }

      toast.success(t("success"), {
        description:
          hasUsers && target
            ? t("successDescMoved", {
                count: role.usersCount,
                name: resolveRoleName(target, locale),
              })
            : t("successDesc"),
      });
      setOpen(false);
      onSaved?.();
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
              ? t("descWithUsers", { count: role.usersCount, name: roleName })
              : t("desc", { name: roleName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasUsers && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("moveToLabel")}</span>
            <MoveRolePicker
              excludeId={role.id}
              onSelect={setTarget}
              searchRoles={searchRoles}
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

const EditRoleAction = ({
  onSave,
  onSaved,
  role,
}: {
  onSave: RolesAdminTableProps["onSave"];
  onSaved?: () => void;
  role: AdminRoleRow;
}) => {
  const t = useTranslations("admin.role.edit");

  return (
    <Dialog>
      <TooltipWithContent text={t("title")}>
        <DialogTrigger
          render={
            <Button aria-label={t("title")} size="icon" variant="ghost" />
          }
        >
          <PencilIcon />
        </DialogTrigger>
      </TooltipWithContent>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <AdminRoleFormContent data={role} onSave={onSave} onSaved={onSaved} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Which of the two buttons a row shows.
 *
 * Four permissions and one structural rule, exactly as the Next.js version has
 * them: a system role (protected, default, root or guest) can never be deleted
 * whatever the permission set says, and a role that *grants administrator
 * access* needs the elevated `can_edit_admin` / `can_delete_admin` on top of the
 * ordinary one. Both are re-checked by the API.
 */
const RoleRowActions = ({
  onDelete,
  onSave,
  onSaved,
  role,
  searchRoles,
}: {
  onDelete: RolesAdminTableProps["onDelete"];
  onSave: RolesAdminTableProps["onSave"];
  onSaved?: () => void;
  role: AdminRoleRow;
  searchRoles: AdminRoleSearch;
}) => {
  const canEdit = useAdminStaffPermission(ADMIN_ROLE_PERMISSIONS.edit);
  const canEditAdmin = useAdminStaffPermission(
    ADMIN_ROLE_PERMISSIONS.editAdmin,
  );
  const canDelete = useAdminStaffPermission(ADMIN_ROLE_PERMISSIONS.delete);
  const canDeleteAdmin = useAdminStaffPermission(
    ADMIN_ROLE_PERMISSIONS.deleteAdmin,
  );

  const isSystem = role.protected || role.default || role.root || role.guest;
  const showEdit = canEdit && (!role.grantsAdmin || canEditAdmin);
  const showDelete =
    canDelete && !isSystem && (!role.grantsAdmin || canDeleteAdmin);

  if (!showEdit && !showDelete) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      {showEdit && (
        <EditRoleAction onSave={onSave} onSaved={onSaved} role={role} />
      )}
      {showDelete && (
        <DeleteRoleAction
          onDelete={onDelete}
          onSaved={onSaved}
          role={role}
          searchRoles={searchRoles}
        />
      )}
    </div>
  );
};

/** The header's create button, gated on `roles:can_create`. */
export const CreateRoleAction = ({
  onSave,
  onSaved,
}: {
  onSave: RolesAdminTableProps["onSave"];
  onSaved?: () => void;
}) => {
  const t = useTranslations("admin.role.create");

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        {t("title")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <AdminRoleFormContent onSave={onSave} onSaved={onSaved} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

export const RolesAdminTableContent = ({
  data,
  LinkComponent,
  onDelete,
  onSave,
  onSaved,
  searchRoles,
}: RolesAdminTableProps) => {
  const t = useTranslations("admin.role.list");

  return (
    <ContentDataTable<AdminRoleRow>
      columns={[
        {
          accessorKey: "name",
          cell: ({ row }) => <RoleFormatContent role={row} />,
          header: t("role"),
        },
        {
          accessorKey: "usersCount",
          cell: ({ row }) => {
            if (row.usersCount === 0) {
              return <span className="text-muted-foreground">0</span>;
            }

            return (
              <TooltipWithContent text={t("openUsersTooltip")}>
                <LinkComponent
                  className="text-primary inline-flex items-center gap-2"
                  href={`/admin/core/users?roleId=${row.id}`}
                >
                  {row.usersCount} <ExternalLink className="size-4" />
                </LinkComponent>
              </TooltipWithContent>
            );
          },
          header: t("usersCount"),
        },
        {
          accessorKey: "updatedAt",
          cell: ({ row }) => <DateFormat date={row.updatedAt} />,
          header: t("updatedAt"),
        },
        {
          align: "right",
          cell: ({ row }) => (
            <RoleRowActions
              onDelete={onDelete}
              onSave={onSave}
              onSaved={onSaved}
              role={row}
              searchRoles={searchRoles}
            />
          ),
          className: "w-20",
          header: "",
          id: "actions",
        },
      ]}
      customNoResults={{
        description: t("noResults.description"),
        icon: <ShieldIcon />,
        title: t("noResults.title"),
      }}
      edges={data.edges}
      id="roles-table"
      order={{
        columns: ["updatedAt"],
        defaultOrder: ADMIN_ROLES_DEFAULT_ORDER,
      }}
      pageInfo={data.pageInfo}
      search
      searchPlaceholder={t("searchPlaceholder")}
    />
  );
};
