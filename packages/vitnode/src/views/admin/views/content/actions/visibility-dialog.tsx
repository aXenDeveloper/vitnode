import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { ContentVisibilityAction } from "@/content/visibility";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";

export const CONTENT_VISIBILITY_ICONS: Record<
  ContentVisibilityAction,
  React.ReactNode
> = {
  hide: <EyeOffIcon />,
  unhide: <EyeIcon />,
};

export const ContentVisibilityDialog = ({
  action,
  children,
  finalFocus,
  onConfirm,
  onOpenChange,
  open,
  singular,
  title,
}: {
  action: ContentVisibilityAction;
  children?: React.ReactElement;
  finalFocus?: React.RefObject<HTMLElement | null>;
  onConfirm: () => Promise<boolean>;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  singular: string;
  title: string;
}) => {
  const t = useTranslations("core.content");

  return (
    <ConfirmActionAlertDialog
      description={t.rich(`${action}.desc`, {
        title: () => <span className="text-foreground font-bold">{title}</span>,
      })}
      finalFocus={finalFocus}
      icon={CONTENT_VISIBILITY_ICONS[action]}
      onOpenChange={onOpenChange}
      onSubmit={async ({ onClose }) => {
        if (await onConfirm()) onClose();
      }}
      open={open}
      submitVariant={action === "hide" ? "destructive" : "default"}
      textSubmit={t(`${action}.confirm`)}
      title={t(`${action}.title`, { name: singular })}
    >
      {children}
    </ConfirmActionAlertDialog>
  );
};
