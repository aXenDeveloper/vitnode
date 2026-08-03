import { useTranslations } from "next-intl";
import React from "react";

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
  onSubmit: (props: { onClose: () => void }) => Promise<void> | void;
  /**
   * Defaults to `destructive`, which is right for the deletes this dialog was
   * built for - and wrong for a confirmation that publishes something.
   */
  submitVariant?: React.ComponentProps<typeof Button>["variant"];
  textSubmit?: string;
}) => {
  const t = useTranslations("core.global.confirm_action");
  const { setOpen } = useAlertDialog();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, formAction, isLoading] = React.useActionState(async () => {
    await onSubmit({ onClose: () => setOpen?.(false) });
  }, null);

  return (
    <form action={formAction}>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
        <Button isLoading={isLoading} type="submit" variant={submitVariant}>
          {textSubmit ?? t("confirm")}
        </Button>
      </AlertDialogFooter>
    </form>
  );
};
