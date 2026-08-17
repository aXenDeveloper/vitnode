"use client";

import { EyeOffIcon, SendIcon } from "lucide-react";
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
import {
  publishContentAction,
  unpublishContentAction,
} from "./mutation-api.server";

/**
 * The publish/unpublish row action.
 *
 * One button that flips with the row's state, rather than two that are half
 * disabled: a draft can only be published and a published row can only be
 * unpublished, so showing both would be showing a dead one.
 *
 * Gated by `can_publish`, never by `can_edit`. That separation is the whole
 * point of the permission: a role can be trusted to write drafts without being
 * trusted to put them on the internet.
 */
export const PublishContentAction = ({
  contentTypeId,
  id,
  permissionModule,
  pluginId,
  singular,
  status,
  title,
}: {
  contentTypeId: string;
  id: number;
  permissionModule: string;
  pluginId: string;
  singular: string;
  status: unknown;
  title: string;
}) => {
  const tPublish = useTranslations("core.content.publish");
  const tUnpublish = useTranslations("core.content.unpublish");
  const tActions = useTranslations("core.content.actions");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const canPublish = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.publish,
    plugin: pluginId,
  });

  if (!canPublish) return null;

  const published = status === "published";
  const t = published ? tUnpublish : tPublish;
  // The bare verb on the button, the full sentence on the dialog it opens: the
  // tooltip is answering "what is this icon", and the row it sits in already says
  // which record. The confirmation still names the record, where it matters.
  const label = tActions(published ? "unpublish" : "publish");
  const Icon = published ? EyeOffIcon : SendIcon;

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
            const mutation = published
              ? await unpublishContentAction(contentTypeId, id)
              : await publishContentAction(contentTypeId, id);

            if (mutation.error !== undefined) {
              const errorKey = contentErrorKey(mutation.status);

              toast.error(tErrors("title"), {
                description: errorKey
                  ? tContentErrors(errorKey)
                  : tErrors("internal_server_error"),
              });

              // Left open on failure, so the reason is still on screen next to
              // the thing that failed - the same behaviour as the delete dialog.
              return;
            }

            toast.success(t("success", { name: singular }), {
              description: title,
            });
            onClose();
          }}
          submitVariant={published ? "destructive" : "default"}
          textSubmit={t("confirm")}
          title={t("title", { name: singular })}
        >
          <TooltipTrigger
            render={
              <Button aria-label={label} size="icon" variant="ghost">
                <Icon className="size-4" />
              </Button>
            }
          />
        </ConfirmActionAlertDialog>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
