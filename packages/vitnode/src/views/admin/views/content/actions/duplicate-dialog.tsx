import { CopyPlusIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";

/**
 * "Duplicate this record?" - the copy is a draft, with every translation, and
 * nothing about it is public until somebody publishes it.
 *
 * `onConfirm` performs the copy and reports back: `true` closes the dialog,
 * `false` keeps it open so the administrator can read the error and decide.
 */
export const ContentDuplicateDialog = ({
  finalFocus,
  onConfirm,
  onOpenChange,
  open,
  singular,
  title,
}: {
  finalFocus?: React.RefObject<HTMLElement | null>;
  onConfirm: () => Promise<boolean>;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
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
