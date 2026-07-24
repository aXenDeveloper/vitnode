"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import { revokeDeviceAction } from "./revoke-action.server";

export const RevokeDeviceButton = ({
  os,
  publicId,
}: {
  os: string;
  publicId: string;
}) => {
  const t = useTranslations("core.auth.settings.devices.revoke");
  const tGlobal = useTranslations("core.global.errors");

  return (
    <ConfirmActionAlertDialog
      description={t("desc", { os })}
      onSubmit={async ({ onClose }) => {
        const result = await revokeDeviceAction({ publicId });
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
