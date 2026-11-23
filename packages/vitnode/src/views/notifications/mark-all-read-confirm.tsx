import type React from "react";

import { CheckCheckIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";

export const MarkAllReadConfirm = ({
  children,
  onConfirm,
  unread,
}: {
  children: React.ReactElement;
  onConfirm: () => Promise<void>;
  unread: number;
}) => {
  const t = useTranslations("core.global.notifications");

  return (
    <ConfirmActionAlertDialog
      description={t("mark_all_read_confirm.desc")}
      icon={<CheckCheckIcon aria-hidden="true" />}
      onSubmit={async ({ onClose }) => {
        await onConfirm();
        onClose();
      }}
      submitVariant="default"
      textSubmit={
        <>
          <CheckCheckIcon aria-hidden="true" />
          {t("mark_all_read")}
        </>
      }
      title={t("mark_all_read_confirm.title", { count: unread })}
    >
      {children}
    </ConfirmActionAlertDialog>
  );
};
