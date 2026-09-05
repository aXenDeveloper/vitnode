"use client";

import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import type { RevokeDevice } from "./devices-revoke";

export const RevokeDeviceButton = ({
  onRevoke,
  os,
  publicId,
}: {
  onRevoke: RevokeDevice;
  os: string;
  publicId: string;
}) => {
  const t = useTranslations("core.auth.settings.devices.revoke");
  const tGlobal = useTranslations("core.global.errors");

  return (
    <ConfirmActionAlertDialog
      description={t("desc", { os })}
      onSubmit={async ({ onClose }) => {
        const result = await onRevoke({ publicId });

        if (result.error) {
          toast.error(tGlobal("title"), {
            description: tGlobal("internal_server_error"),
          });

          return;
        }

        toast.success(t("success"));
        onClose();
      }}
      textSubmit={t("confirm")}
      title={t("title")}
    >
      <Button aria-label={t("action")} size="icon-sm" variant="destructive">
        <LogOutIcon />
      </Button>
    </ConfirmActionAlertDialog>
  );
};
