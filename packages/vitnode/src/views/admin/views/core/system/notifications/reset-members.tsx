import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import type { NotificationsAdminActions } from "./notifications-mutations";

export const ResetMembersButton = ({
  count,
  onReset,
}: {
  count: number;
  onReset: NotificationsAdminActions["resetMemberPreferences"];
}) => {
  const t = useTranslations("admin.system.notifications.reset_members");
  const tError = useTranslations("core.global.errors");

  return (
    <ConfirmActionAlertDialog
      description={
        <span className="flex flex-col gap-2 leading-relaxed text-pretty">
          <span>{t("desc", { count })}</span>
          <span className="text-foreground font-medium">{t("warning")}</span>
        </span>
      }
      onSubmit={async ({ onClose }) => {
        const mutation = await onReset();

        if (mutation.error !== undefined) {
          toast.error(tError("title"), {
            description: tError("internal_server_error"),
          });

          return;
        }

        onClose();
        toast.success(t("success"), {
          description: t("success_desc", { count: mutation.data.members }),
        });
      }}
      textSubmit={t("submit")}
      title={t("title")}
    >
      <Button className="shrink-0 self-start" variant="outline">
        <RotateCcwIcon aria-hidden />
        {t("button")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};
