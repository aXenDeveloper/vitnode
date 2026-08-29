"use client";

import { useDroppable } from "@dnd-kit/core";
import { LayoutGridIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { cn } from "@/lib/utils";

export const DROP_END_ID = "vitnode-dashboard-drop-end";

export const DropPlaceholder = ({ isEmpty }: { isEmpty: boolean }) => {
  const t = useTranslations("admin.dashboard.widgets");
  const { isOver, setNodeRef } = useDroppable({ id: DROP_END_ID });

  return (
    <div
      className={cn(
        "text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm text-balance transition-colors",
        isEmpty && "md:col-span-2 xl:col-span-3",
        isOver && "border-primary bg-primary/5 text-primary",
      )}
      ref={setNodeRef}
    >
      <LayoutGridIcon className="size-5" />
      {t("drop_here")}
    </div>
  );
};
