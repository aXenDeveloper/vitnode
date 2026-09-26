import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { Settings2Icon, Trash2Icon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DRAG_SHIFT_TRANSITION } from "@/lib/dnd/drag-motion";

import type { DashboardWidgetView } from "../widgets/types";
import type { WidgetSize } from "./resize";

import { ResizeHandle } from "./resize-handle";
import { rowsClasses, spanClasses } from "./span-classes";
import { WidgetContentSkeleton } from "./widget-skeleton";

const ARRIVAL_CLASS =
  "animate-in fade-in zoom-in-98 duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none";

const TOOLBAR_SEPARATOR = (
  <span aria-hidden="true" className="bg-border mx-0.5 h-4 w-px" />
);

export const WidgetCardContent = ({
  isEditing,
  widget,
}: {
  isEditing?: boolean;
  widget: DashboardWidgetView;
}) => {
  const content = (
    <React.Suspense fallback={<WidgetContentSkeleton rows={widget.rows} />}>
      {widget.content}
    </React.Suspense>
  );

  return (
    <>
      <CardHeader>
        <CardTitle
          className={cn(
            "flex min-h-8 items-center gap-2 text-balance",
            isEditing && (widget.hasSettings ? "pe-24" : "pe-12"),
          )}
        >
          {!!widget.icon && (
            <span className="text-muted-foreground [&_svg]:size-4">
              {widget.icon}
            </span>
          )}
          {widget.title}
        </CardTitle>
        {!!widget.desc && (
          <CardDescription className="text-pretty">
            {widget.desc}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {isEditing ? (
          <div
            className="pointer-events-none opacity-60"
            inert
            key={widget.contentKey}
          >
            {content}
          </div>
        ) : (
          <React.Fragment key={widget.contentKey}>{content}</React.Fragment>
        )}
      </CardContent>
    </>
  );
};

export const WidgetCard = ({
  isArriving,
  isEditing,
  isSelected,
  onRemove,
  onResize,
  onSelect,
  widget,
}: {
  isArriving: boolean;
  isEditing: boolean;
  isSelected: boolean;
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
  onSelect: (id: string) => void;
  widget: DashboardWidgetView;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const reduceMotion = useReducedMotion();
  const [resizing, setResizing] = React.useState(false);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: !isEditing,
    id: widget.instanceId,
    transition: reduceMotion ? null : DRAG_SHIFT_TRANSITION,
  });

  return (
    <Card
      className={cn(
        "group/widget relative flex flex-col transition-[box-shadow,background-color,outline-color] duration-150 ease-out motion-reduce:transition-none",
        spanClasses[widget.span],
        rowsClasses[widget.rows],
        isEditing &&
          !isDragging &&
          !resizing &&
          "cursor-grab active:cursor-grabbing",
        isEditing &&
          !isDragging &&
          !resizing &&
          !isSelected &&
          "hover:ring-primary/50",
        isEditing && isSelected && !isDragging && "ring-primary ring-2",
        resizing && "ring-primary z-20 ring-2",
        isDragging &&
          "bg-primary/5 outline-primary/50 ring-0 outline-2 -outline-offset-2 outline-dashed *:opacity-30",
        isArriving && ARRIVAL_CLASS,
      )}
      data-dashboard-widget={widget.instanceId}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...(isEditing ? listeners : {})}
    >
      {isEditing && (
        <button
          {...attributes}
          aria-current={isSelected}
          aria-label={t("select", { title: widget.title })}
          className="focus-visible:ring-ring absolute inset-0 cursor-grab rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-inset active:cursor-grabbing"
          onClick={() => {
            onSelect(widget.instanceId);
          }}
          ref={setActivatorNodeRef}
          type="button"
        />
      )}

      {isEditing && (
        <div
          className="border-border bg-popover text-popover-foreground absolute inset-e-3 top-3 z-10 flex items-center gap-0.5 rounded-lg border p-0.5 shadow-md"
          onKeyDown={event => event.stopPropagation()}
          onPointerDown={event => event.stopPropagation()}
        >
          {!!widget.hasSettings && (
            <>
              <Button
                aria-label={t("settings.open", { title: widget.title })}
                onClick={() => {
                  onSelect(widget.instanceId);
                }}
                size="icon-sm"
                variant="ghost"
              >
                <Settings2Icon />
              </Button>
              {TOOLBAR_SEPARATOR}
            </>
          )}

          <Button
            aria-label={t("remove", { title: widget.title })}
            className="hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(widget.instanceId)}
            size="icon-sm"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </div>
      )}

      <WidgetCardContent isEditing={isEditing} widget={widget} />

      {isEditing && (
        <ResizeHandle
          onResize={size => onResize(widget.instanceId, size)}
          onResizingChange={setResizing}
          widget={widget}
        />
      )}
    </Card>
  );
};
