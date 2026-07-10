"use client";

import { LockIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { Link } from "@/lib/navigation";

import { deleteStaffEntry } from "./delete-action";

export const StaffRowActions = ({
  type,
  id,
  protected: isProtected,
  self,
  canEdit,
  canDelete,
}: {
  canDelete: boolean;
  canEdit: boolean;
  id: number;
  protected: boolean;
  self: boolean;
  type: PermissionStaffType;
}) => {
  const t = useTranslations("admin.staff");
  const tGlobal = useTranslations("core.global");

  // Protected entries are managed by the system, and an admin cannot manage the
  // entry that governs their own access - neither can be edited or removed.
  if (isProtected || self) {
    return (
      <div className="flex justify-end">
        <TooltipWithContent text={isProtected ? t("protected") : t("self")}>
          <span className="text-muted-foreground inline-flex p-2">
            <LockIcon className="size-4" />
          </span>
        </TooltipWithContent>
      </div>
    );
  }

  // No actionable permissions - render an empty cell.
  if (!canEdit && !canDelete) {
    return null;
  }

  const editHref = `/admin/core/staff/${
    type === "admin" ? "admins" : "moderators"
  }/edit/${id}`;

  return (
    <div className="flex items-center justify-end gap-1">
      {canEdit && (
        <Button
          aria-label={t("table.edit")}
          nativeButton={false}
          render={<Link href={editHref} />}
          size="icon-sm"
          variant="ghost"
        >
          <PencilIcon />
        </Button>
      )}

      {canDelete && (
        <ConfirmActionAlertDialog
          description={t("delete.desc")}
          onSubmit={async ({ onClose }) => {
            const result = await deleteStaffEntry({ type, id });
            if (result.error) {
              toast.error(tGlobal("errors.title"), {
                description: tGlobal("errors.internal_server_error"),
              });

              return;
            }

            toast.success(t("delete.success"));
            onClose();
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
