"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTENT_PERMISSIONS } from "@/content/const";

import { deleteContentAction } from "./mutation-api.server";

export const DeleteContentAction = ({
  contentTypeId,
  id,
  permissionModule,
  pluginId,
  singular,
  title,
}: {
  contentTypeId: string;
  id: number;
  permissionModule: string;
  pluginId: string;
  singular: string;
  title: string;
}) => {
  const t = useTranslations("core.content.delete");
  const tErrors = useTranslations("core.global.errors");
  const tConflict = useTranslations("core.content.errors");
  const canDelete = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.delete,
    plugin: pluginId,
  });

  if (!canDelete) return null;

  const label = t("title", { name: singular });

  return (
    <TooltipProvider>
      <Tooltip>
        <ConfirmActionAlertDialog
          description={t.rich("desc", {
            title: () => (
              <span className="text-foreground font-bold">{title}</span>
            ),
          })}
          onSubmit={async ({ onClose }) => {
            const mutation = await deleteContentAction(contentTypeId, id);

            if (mutation.error !== undefined) {
              toast.error(tErrors("title"), {
                description:
                  mutation.status === 409
                    ? tConflict("conflict")
                    : tErrors("internal_server_error"),
              });

              return;
            }

            toast.success(t("success", { name: singular }), {
              description: title,
            });
            onClose();
          }}
          textSubmit={t("confirm")}
          title={label}
        >
          <TooltipTrigger
            render={
              <Button aria-label={label} size="icon" variant="destructive">
                <Trash2Icon className="size-4" />
              </Button>
            }
          />
        </ConfirmActionAlertDialog>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
