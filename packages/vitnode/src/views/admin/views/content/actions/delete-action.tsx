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

import { contentErrorKey } from "../lib/mutation-feedback";
import { deleteContentAction } from "./mutation-api.server";

export const DeleteContentAction = ({
  contentTypeId,
  id,
  permissionModule,
  pluginId,
  singular,
  title,
  version,
}: {
  contentTypeId: string;
  id: number;
  permissionModule: string;
  pluginId: string;
  singular: string;
  title: string;
  /**
   * The version this row showed. `undefined` for a content type without
   * `editorial`, whose delete has no precondition and never had one.
   */
  version?: number;
}) => {
  const t = useTranslations("core.content.delete");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
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
            const mutation = await deleteContentAction(
              contentTypeId,
              id,
              version,
            );

            if (mutation.error !== undefined) {
              // Someone saved while this dialog was open. Deliberately *not*
              // retried with the new version: the whole point of the
              // precondition is that the person confirms deleting the record as
              // it is now, and they have not seen what changed.
              if (mutation.conflict?.code === "CONTENT_VERSION_CONFLICT") {
                toast.error(t("conflict.title"), {
                  description: t("conflict.desc"),
                });

                return;
              }

              // A restricted delete (409) is a normal, explainable outcome; an
              // unrecognised status is a server fault and reads as one.
              const errorKey = contentErrorKey(mutation.status);

              toast.error(tErrors("title"), {
                description: errorKey
                  ? tContentErrors(errorKey)
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
