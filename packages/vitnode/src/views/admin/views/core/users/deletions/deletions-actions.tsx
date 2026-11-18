import { BanIcon, RotateCwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import type { AdminMutationResult } from "../../shared/admin-mutation";

import { isAdminMutationError } from "../../shared/admin-mutation";

export interface AccountDeletionActionsProps {
  onCancel: (deletionId: number) => Promise<AdminMutationResult<true>>;
  onErase: (
    deletionId: number,
  ) => Promise<AdminMutationResult<{ status: "completed" | "failed" }>>;
}

/** Erase now (or retry a failed erasure) and cancel, for one open request. */
export const AccountDeletionActions = ({
  deletionId,
  onCancel,
  onErase,
  size = "sm",
  status,
}: AccountDeletionActionsProps & {
  deletionId: number;
  size?: "default" | "sm";
  status: "failed" | "pending";
}) => {
  const t = useTranslations("admin.user.deletions");
  const tErrors = useTranslations("core.global.errors");
  const failed = status === "failed";
  const EraseIcon = failed ? RotateCwIcon : Trash2Icon;

  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmActionAlertDialog
        description={t("retry.desc")}
        icon={<EraseIcon />}
        onSubmit={async ({ onClose }) => {
          const result = await onErase(deletionId);
          onClose();
          if (isAdminMutationError(result)) {
            toast.error(tErrors("title"), {
              description: tErrors("internal_server_error"),
            });

            return;
          }
          if (result.data.status === "failed") {
            toast.error(t("retry.failed"), {
              description: t("retry.failed_desc"),
            });

            return;
          }
          toast.success(t("retry.success"), {
            description: t("retry.success_desc"),
          });
        }}
        textSubmit={
          <>
            <EraseIcon aria-hidden="true" />
            {t(failed ? "retry.action" : "retry.now")}
          </>
        }
        title={t("retry.title")}
      >
        <Button size={size} variant={failed ? "destructive" : "outline"}>
          <EraseIcon aria-hidden="true" />
          {t(failed ? "retry.action" : "retry.now")}
        </Button>
      </ConfirmActionAlertDialog>

      <ConfirmActionAlertDialog
        description={t("cancel.desc")}
        icon={<BanIcon />}
        onSubmit={async ({ onClose }) => {
          const result = await onCancel(deletionId);
          onClose();
          if (isAdminMutationError(result)) {
            toast.error(tErrors("title"), {
              description: tErrors("internal_server_error"),
            });

            return;
          }
          toast.success(t("cancel.success"), {
            description: t("cancel.success_desc"),
          });
        }}
        submitVariant="default"
        textSubmit={
          <>
            <BanIcon aria-hidden="true" />
            {t("cancel.confirm")}
          </>
        }
        title={t("cancel.title")}
      >
        <Button size={size} variant="ghost">
          <BanIcon aria-hidden="true" />
          {t("cancel.action")}
        </Button>
      </ConfirmActionAlertDialog>
    </div>
  );
};
