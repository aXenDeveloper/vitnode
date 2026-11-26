import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { Settings2Icon, Trash2Icon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Frame,
  FrameAction,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { DRAG_SHIFT_TRANSITION } from "@/lib/dnd/drag-motion";

import type { DashboardWidgetView } from "../widgets/types";
import type { WidgetSize } from "./resize";

import { ResizeHandle } from "./resize-handle";
import { rowsClasses, spanClasses } from "./span-classes";
import { WidgetContentSkeleton } from "./widget-skeleton";

const ARRIVAL_CLASS =
  "animate-in fade-in zoom-in-98 duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none";

export const WidgetFrameContent = ({
  action,
  isEditing,
  widget,
}: {
  action?: React.ReactNode;
  isEditing?: boolean;
  widget: DashboardWidgetView;
}) => {
  const content = (
    <React.Suspense
      fallback={
        <div className={cn(widget.flush && "p-4")}>
          <WidgetContentSkeleton rows={widget.rows} />
        </div>
      }
    >
      {widget.content}
    </React.Suspense>
  );

  return (
    <>
      <FrameHeader>
        <FrameTitle className="flex min-w-0 items-center gap-2" render={<h2 />}>
          {!!widget.icon && (
            <span
              aria-hidden="true"
              className="text-muted-foreground flex shrink-0 [&_svg]:size-4"
            >
              {widget.icon}
            </span>
          )}
          <span className="min-w-0 truncate">{widget.title}</span>
        </FrameTitle>
        {!!widget.desc && <FrameDescription>{widget.desc}</FrameDescription>}
        {action}
      </FrameHeader>

      <FramePanel>
        <div className={cn("flex flex-1 flex-col", !widget.flush && "p-4")}>
          {isEditing ? (
            <div
              className="pointer-events-none flex flex-1 flex-col opacity-60"
              inert
              key={widget.contentKey}
            >
              {content}
            </div>
          ) : (
            <React.Fragment key={widget.contentKey}>{content}</React.Fragment>
          )}
        </div>
      </FramePanel>
    </>
  );
};

const WidgetEditTools = ({
  onRemove,
  onSelect,
  widget,
}: {
  onRemove: () => void;
  onSelect: () => void;
  widget: DashboardWidgetView;
}) => {
  const t = useTranslations("admin.dashboard.widgets");

  return (
    <FrameAction
      className="relative z-10 gap-0.5"
      onKeyDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      {!!widget.hasSettings && (
        <Button
          aria-label={t("settings.open", { title: widget.title })}
          onClick={onSelect}
          size="icon-sm"
          variant="ghost"
        >
          <Settings2Icon />
        </Button>
      )}

      <Button
        aria-label={t("remove", { title: widget.title })}
        className="hover:bg-destructive/10 hover:text-destructive"
        onClick={onRemove}
        size="icon-sm"
        variant="ghost"
      >
        <Trash2Icon />
      </Button>
    </FrameAction>
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
    <Frame
      className={cn(
        "group/widget relative transition-[box-shadow,background-color,outline-color] duration-150 ease-out motion-reduce:transition-none",
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
          "bg-primary/5 outline-primary/50 ring-0 outline-2 -outline-offset-2 outline-dashed *:opacity-0",
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
          className="focus-visible:ring-ring absolute inset-0 cursor-grab rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset active:cursor-grabbing"
          onClick={() => {
            onSelect(widget.instanceId);
          }}
          ref={setActivatorNodeRef}
          type="button"
        />
      )}

      <WidgetFrameContent
        action={
          isEditing ? (
            <WidgetEditTools
              onRemove={() => onRemove(widget.instanceId)}
              onSelect={() => onSelect(widget.instanceId)}
              widget={widget}
            />
          ) : null
        }
        isEditing={isEditing}
        widget={widget}
      />

      {isEditing && (
        <ResizeHandle
          onResize={size => onResize(widget.instanceId, size)}
          onResizingChange={setResizing}
          widget={widget}
        />
      )}
    </Frame>
  );
};
