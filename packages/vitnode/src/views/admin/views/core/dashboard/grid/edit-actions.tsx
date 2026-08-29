"use client";

import { PencilIcon, SaveIcon, XIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import { useDashboardBoard } from "./board-provider";

export const DashboardEditActions = () => {
  const t = useTranslations("admin.dashboard.widgets");
  const { isEditing, setIsEditing } = useDashboardBoard();

  if (isEditing) return null;

  return (
    <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
      <PencilIcon />
      {t("edit")}
    </Button>
  );
};

export const DashboardPanelActions = () => {
  const t = useTranslations("core.global");
  const { isDirty, isPending, onCancel, onSave } = useDashboardBoard();

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button disabled={isPending} onClick={onCancel} variant="outline">
        <XIcon />
        {t("cancel")}
      </Button>
      <Button disabled={isPending || !isDirty} onClick={onSave}>
        <SaveIcon />
        {t("save")}
      </Button>
    </div>
  );
};
