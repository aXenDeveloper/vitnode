import React from "react";
import { useTranslations } from "use-intl";

import {
  AlertDialogCancel,
  AlertDialogFooter,
  useAlertDialog,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";

export const ContentConfirmAction = ({
  onSubmit,
  submitVariant = "destructive",
  textSubmit,
}: {
  /** Runs on confirm; call `onClose` to close the dialog. */
  onSubmit: (props: { onClose: () => void }) => Promise<void> | void;
  /** Defaults to `destructive`. */
  submitVariant?: React.ComponentProps<typeof Button>["variant"];
  /** The confirm button's label. Defaults to a translated "Yes, confirm". */
  textSubmit?: string;
}) => {
  const t = useTranslations("core.global.confirm_action");
  const { setOpen } = useAlertDialog();

  const [_, formAction, isLoading] = React.useActionState(async () => {
    await onSubmit({ onClose: () => setOpen?.(false) });
  }, null);

  return (
    <form action={formAction} onSubmit={event => event.stopPropagation()}>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isLoading}>
          {t("cancel")}
        </AlertDialogCancel>
        <Button isLoading={isLoading} type="submit" variant={submitVariant}>
          {textSubmit ?? t("confirm")}
        </Button>
      </AlertDialogFooter>
    </form>
  );
};
