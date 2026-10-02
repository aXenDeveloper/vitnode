import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { DeletePasskey } from "./passkeys-mutations";

export const DeletePasskeyButton = ({
  id,
  isPasswordEnabled,
  name,
  onDelete,
}: {
  id: number;
  isPasswordEnabled: boolean;
  name: string;
  onDelete: DeletePasskey;
}) => {
  const t = useTranslations("core.auth.settings.passkeys");
  const tErrors = useTranslations("core.global.errors");

  return (
    <TooltipProvider>
      <Tooltip>
        <ConfirmActionAlertDialog
          description={t("delete.desc", { name })}
          icon={<Trash2Icon />}
          onSubmit={async ({ onClose }) => {
            const result = await onDelete({ id });

            if (!result.ok) {
              if (result.failure === "server_error") {
                toast.error(tErrors("title"), {
                  description: tErrors("internal_server_error"),
                });

                return;
              }

              toast.error(t(`errors.${result.failure}.title`), {
                description:
                  result.failure === "last_recovery_method" &&
                  !isPasswordEnabled
                    ? t("errors.last_recovery_method.desc_passwordless")
                    : t(`errors.${result.failure}.desc`),
              });
              onClose();

              return;
            }

            toast.success(t("delete.success"), {
              description: t("delete.success_desc", { name }),
            });
            onClose();
          }}
          textSubmit={t("delete.confirm")}
          title={t("delete.title")}
        >
          <TooltipTrigger
            render={
              <Button
                aria-label={t("delete.action")}
                className="relative after:absolute after:-inset-1.5"
                size="icon-sm"
                variant="destructive"
              >
                <Trash2Icon />
              </Button>
            }
          />
        </ConfirmActionAlertDialog>

        <TooltipContent>{t("delete.action")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
