import { CopyPlusIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";

export const ContentDuplicateDialog = ({
  finalFocus,
  onConfirm,
  onOpenChange,
  open,
  singular,
  title,
}: {
  finalFocus: React.RefObject<HTMLElement | null>;
  onConfirm: () => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  singular: string;
  title: string;
}) => {
  const t = useTranslations("core.content.duplicate");

  return (
    <ConfirmActionAlertDialog
      description={t.rich("desc", {
        title: () => <span className="text-foreground font-bold">{title}</span>,
      })}
      finalFocus={finalFocus}
      icon={<CopyPlusIcon />}
      onOpenChange={onOpenChange}
      onSubmit={async ({ onClose }) => {
        if (await onConfirm()) onClose();
      }}
      open={open}
      submitVariant="default"
      textSubmit={t("confirm")}
      title={t("title", { name: singular })}
    />
  );
};
