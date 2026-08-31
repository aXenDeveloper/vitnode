"use client";

import { LockIcon, PencilIcon, ShieldUserIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type {
  AdminStaffPage,
  AdminStaffRow,
} from "@/views/admin/views/core/staff/staff-query";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { RoleFormatContent } from "@/components/role-format-content";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { ContentDataTable } from "@/components/table/content";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import {
  STAFF_TYPE_SEGMENT,
  staffEditHref,
} from "@/views/admin/views/core/staff/staff-model";
import { ADMIN_STAFF_DEFAULT_ORDER } from "@/views/admin/views/core/staff/staff-query";

import { StaffUserFormatContent } from "./staff-user-format-content";

/**
 * The administrators and moderators tables, with no framework in them.
 *
 * One component for both groups: they are the same five columns over two
 * tables, and which permission module governs them is the only difference -
 * `staff_admins` or `staff_moderators`, resolved by
 * {@link adminStaffPermissions} so a button is hidden for exactly the reason the
 * API would refuse it.
 *
 * The delete arrives as a prop, and what to do after it (revalidate a path,
 * invalidate a query key) is the caller's.
 */

export interface StaffTableProps {
  data: AdminStaffPage;
  LinkComponent: AuthLinkComponent;
  onDelete: (args: {
    id: number;
    type: PermissionStaffType;
  }) => Promise<AdminMutationResult<unknown>>;
  onDeleted?: () => void;
  type: PermissionStaffType;
}

/**
 * A row's two buttons, or the padlock that replaces both.
 *
 * `protected` is an entry the installation manages, and `self` is the entry that
 * governs *the reading administrator's own* access - their user entry, or an
 * entry for a role they hold. The API refuses to edit or delete either
 * (`update-permissions.route.ts` and `delete.route.ts` both re-derive the
 * caller's roles), so an administrator can neither escalate themselves nor lock
 * themselves out. Showing a padlock with the reason is the honest rendering of a
 * rule that is enforced elsewhere; hiding the row would make the entry look
 * missing.
 */
const StaffRowActions = ({
  LinkComponent,
  onDelete,
  onDeleted,
  row,
  type,
}: {
  LinkComponent: AuthLinkComponent;
  onDelete: StaffTableProps["onDelete"];
  onDeleted?: () => void;
  row: AdminStaffRow;
  type: PermissionStaffType;
}) => {
  const t = useTranslations("admin.staff");
  const tGlobal = useTranslations("core.global");
  const permissions = adminStaffPermissions(type);
  const canEdit = useAdminStaffPermission(permissions.edit);
  const canDelete = useAdminStaffPermission(permissions.delete);

  if (row.protected || row.self) {
    return (
      <div className="flex justify-end">
        <TooltipWithContent text={row.protected ? t("protected") : t("self")}>
          <span className="text-muted-foreground inline-flex p-2">
            <LockIcon className="size-4" />
          </span>
        </TooltipWithContent>
      </div>
    );
  }

  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      {canEdit && (
        <LinkComponent
          aria-label={t("table.edit")}
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          href={staffEditHref(type, row.id)}
        >
          <PencilIcon />
        </LinkComponent>
      )}

      {canDelete && (
        <ConfirmActionAlertDialog
          description={t("delete.desc")}
          onSubmit={async ({ onClose }) => {
            const result = await onDelete({ id: row.id, type });
            if ("error" in result) {
              toast.error(tGlobal("errors.title"), {
                description: tGlobal("errors.internal_server_error"),
              });

              return;
            }

            toast.success(t("delete.success"));
            onClose();
            onDeleted?.();
          }}
          textSubmit={t("delete.confirm")}
          title={t("delete.title")}
        >
          <Button
            aria-label={t("delete.title")}
            size="icon-sm"
            variant="destructive"
          >
            <Trash2Icon />
          </Button>
        </ConfirmActionAlertDialog>
      )}
    </div>
  );
};

export const StaffTableContent = ({
  data,
  LinkComponent,
  onDelete,
  onDeleted,
  type,
}: StaffTableProps) => {
  const t = useTranslations("admin.staff.table");
  const tType = useTranslations(
    `admin.staff.${STAFF_TYPE_SEGMENT[type]}` as "admin.staff.admins",
  );

  return (
    <ContentDataTable<AdminStaffRow>
      columns={[
        {
          accessorKey: "role",
          cell: ({ row }) =>
            row.role ? (
              <RoleFormatContent role={row.role} />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          header: t("role"),
        },
        {
          accessorKey: "user",
          cell: ({ row }) =>
            row.user ? (
              <StaffUserFormatContent user={row.user} />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          header: t("user"),
        },
        {
          accessorKey: "unrestricted",
          cell: ({ row }) =>
            row.unrestricted ? (
              <Badge>{t("unrestricted")}</Badge>
            ) : (
              <Badge variant="secondary">{t("restricted")}</Badge>
            ),
          header: t("permissions"),
        },
        {
          accessorKey: "updatedAt",
          cell: ({ row }) => <DateFormat date={row.updatedAt} />,
          header: t("updatedAt"),
        },
        {
          align: "right",
          cell: ({ row }) => (
            <StaffRowActions
              LinkComponent={LinkComponent}
              onDelete={onDelete}
              onDeleted={onDeleted}
              row={row}
              type={type}
            />
          ),
          className: "w-10",
          header: "",
          id: "actions",
        },
      ]}
      customNoResults={{
        description: tType("noResults.description"),
        icon: <ShieldUserIcon />,
        title: tType("noResults.title"),
      }}
      edges={data.edges}
      id={`staff-${STAFF_TYPE_SEGMENT[type]}-table`}
      order={{
        columns: ["updatedAt"],
        defaultOrder: ADMIN_STAFF_DEFAULT_ORDER,
      }}
      pageInfo={data.pageInfo}
    />
  );
};
