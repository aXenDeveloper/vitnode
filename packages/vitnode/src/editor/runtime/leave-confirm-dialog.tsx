import type { ReactElement } from "react";

import { SaveIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { VisualEditorSaveStatus } from "../context";

export const LeaveConfirmDialog = ({
  onConfirm,
  onOpenChange,
  onSave,
  open,
  saveStatus = "idle",
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
  open: boolean;
  saveStatus?: VisualEditorSaveStatus;
}): ReactElement => {
  const t = useTranslations("core.editor");
  const saving = saveStatus === "saving";

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {onSave ? t("leave.choice_title") : t("leave.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {onSave ? t("leave.choice_desc") : t("leave.desc")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {saveStatus === "error" ? (
          <p
            className="text-destructive text-sm leading-relaxed text-pretty"
            role="status"
          >
            {t("save_failed")}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>{t("leave.cancel")}</AlertDialogCancel>

          <AlertDialogAction
            disabled={saving}
            onClick={onConfirm}
            variant="destructive"
          >
            {t("leave.confirm")}
          </AlertDialogAction>

          {onSave ? (
            <Button disabled={saving} isLoading={saving} onClick={onSave}>
              <SaveIcon />
              {t("leave.save")}
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
