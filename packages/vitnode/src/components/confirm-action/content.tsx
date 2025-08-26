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
  textSubmit,
}: {
  onSubmit: (props: { onClose: () => void }) => Promise<void> | void;
  textSubmit?: string;
}) => {
  const t = useTranslations("core.global.confirm_action");
  const { setOpen } = useAlertDialog();

  const [_, formAction, isLoading] = React.useActionState(async () => {
    await onSubmit({ onClose: () => setOpen?.(false) });
  }, null);

  return (
    <form action={formAction}>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
        <Button isLoading={isLoading} type="submit" variant="destructive">
          {textSubmit ?? t("confirm")}
        </Button>
      </AlertDialogFooter>
    </form>
  );
};
