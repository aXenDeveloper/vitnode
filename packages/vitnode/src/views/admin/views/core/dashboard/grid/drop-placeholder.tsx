import { useDndContext, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { cn } from "cn";
import { LayoutGridIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type {
  AdminDashboardWidgetSpan,
  DashboardWidgetOption,
} from "../widgets/types";

import { INCOMING_ID } from "./incoming";
import { rowsClasses, spanClasses } from "./span-classes";

export const DROP_END_ID = "vitnode-dashboard-drop-end";

const DROP_AREA_CLASS =
  "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-[background-color,border-color,color] duration-150 ease-out motion-reduce:transition-none";

export const DropPlaceholder = ({ isEmpty }: { isEmpty: boolean }) => {
  const t = useTranslations("admin.dashboard.widgets");
  const { active } = useDndContext();
  const { isOver, setNodeRef } = useDroppable({ id: DROP_END_ID });
  const dragging = active !== null;

  return (
    <div
      className={cn(
        DROP_AREA_CLASS,
        isEmpty ? "min-h-56 md:col-span-2 xl:col-span-3" : "min-h-32",
        isOver
          ? "border-primary bg-primary/15 text-primary"
          : dragging
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-primary/40 bg-primary/5 text-primary",
      )}
      ref={setNodeRef}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 items-center justify-center rounded-full transition-colors duration-150",
          isOver ? "bg-primary text-primary-foreground" : "bg-primary/10",
        )}
      >
        <PlusIcon className="size-5" />
      </span>

      <p className="text-sm leading-relaxed font-medium text-balance">
        {t("drop_here")}
      </p>

      {dragging ? null : (
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {t("drop_hint")}
        </p>
      )}
    </div>
  );
};

export const IncomingPlaceholder = ({
  widget,
}: {
  widget: DashboardWidgetOption;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const { setNodeRef } = useSortable({
    disabled: { draggable: true, droppable: false },
    id: INCOMING_ID,
  });
  const span = Math.max(
    widget.defaultSpan,
    widget.minSpan,
  ) as AdminDashboardWidgetSpan;

  return (
    <div
      aria-hidden="true"
      className={cn(
        DROP_AREA_CLASS,
        "border-primary bg-primary/10 text-primary animate-in fade-in zoom-in-98 duration-150 motion-reduce:animate-none",
        spanClasses[span],
        rowsClasses[widget.defaultRows],
      )}
      ref={setNodeRef}
    >
      <span className="[&_svg]:size-5">
        {widget.icon ?? <LayoutGridIcon />}
      </span>

      <p className="text-sm leading-relaxed font-medium text-balance">
        {t("drop_incoming", { title: widget.title })}
      </p>
    </div>
  );
};
