import { EyeClosedIcon, ViewIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { ContentVisibilityAction } from "@/content/visibility";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";

/** The icon each visibility action wears - in the row, the menu and the editor. */
export const CONTENT_VISIBILITY_ICONS: Record<
  ContentVisibilityAction,
  React.ReactNode
> = {
  hide: <EyeClosedIcon />,
  unhide: <ViewIcon />,
};

/**
 * "Hide this record?" / "Unhide this record?", with what each one does and
 * does not do to the public site.
 *
 * Hiding is the destructive-looking one: it takes a record off the public site
 * on the spot, although it unpublishes nothing. Unhiding says that it restores
 * public access only to a record that is published.
 *
 * `onConfirm` performs the write and reports back - `true` closes the dialog,
 * `false` keeps it open for another try. The toasts are the caller's, which knows
 * whether it is a list row or an open editor.
 */
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
  /** The trigger, when the dialog opens itself. */
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
