import { cn } from "cn";
import { PencilIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import { useDashboardBoard } from "./board-context";

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
  const t = useTranslations("admin.dashboard.widgets");
  const tGlobal = useTranslations("core.global");
  const { isDirty, isPending, onCancel, onSave } = useDashboardBoard();

  return (
    <div className="flex flex-col gap-3">
      <p
        className="text-muted-foreground flex items-center gap-2 text-sm leading-relaxed"
        role="status"
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full transition-colors duration-150",
            isDirty ? "bg-warn" : "bg-muted-foreground/40",
          )}
        />
        {isDirty ? t("status_unsaved") : t("status_clean")}
      </p>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={isPending}
          onClick={onCancel}
          variant="outline"
        >
          {tGlobal("cancel")}
        </Button>

        <Button
          className="flex-1"
          disabled={isPending || !isDirty}
          isLoading={isPending}
          onClick={onSave}
        >
          <SaveIcon />
          {tGlobal("save")}
        </Button>
      </div>
    </div>
  );
};
