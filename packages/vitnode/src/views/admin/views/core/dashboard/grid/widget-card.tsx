"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Maximize2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type {
  AdminDashboardWidgetSpan,
  DashboardWidgetView,
} from "../widgets/types";

import { rowsClasses, spanClasses } from "./span-classes";
import { WidgetSettingsDialog } from "./widget-settings-dialog";

const SIZE_LABELS = {
  1: "size.small",
  2: "size.medium",
  3: "size.large",
} as const satisfies Record<AdminDashboardWidgetSpan, string>;

const SPANS: AdminDashboardWidgetSpan[] = [1, 2, 3];

export const WidgetCardContent = ({
  isEditing,
  widget,
}: {
  isEditing?: boolean;
  widget: DashboardWidgetView;
}) => (
  <>
    <CardHeader
      className={cn(
        isEditing && "opacity-60",
        isEditing && (widget.settingsContent ? "pe-30" : "pe-20"),
      )}
    >
      <CardTitle className="flex items-center gap-2 text-balance">
        {!!widget.icon && (
          <span className="text-muted-foreground [&_svg]:size-4">
            {widget.icon}
          </span>
        )}
        {widget.title}
      </CardTitle>
      {!!widget.desc && (
        <CardDescription className="text-pretty">{widget.desc}</CardDescription>
      )}
    </CardHeader>
    <CardContent className="flex-1">
      {isEditing ? (
        <div
          className="pointer-events-none opacity-60"
          inert
          key={widget.contentKey}
        >
          {widget.content}
        </div>
      ) : (
        <React.Fragment key={widget.contentKey}>
          {widget.content}
        </React.Fragment>
      )}
    </CardContent>
  </>
);

export const WidgetCard = ({
  isEditing,
  onRemove,
  onResize,
  onSettingsSaved,
  widget,
}: {
  isEditing: boolean;
  onRemove: (id: string) => void;
  onResize: (id: string, span: AdminDashboardWidgetSpan) => void;
  onSettingsSaved: () => void;
  widget: DashboardWidgetView;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    // Keyed on the copy, not the widget - a widget may be on the board twice.
  } = useSortable({ id: widget.instanceId, disabled: !isEditing });

  return (
    // While editing, a press anywhere on the card starts a drag - no grip to aim
    // for. Only the `listeners` live here, though: the ARIA that goes with them
    // belongs on the handle below, because a card announced as a button may not
    // hold the buttons that configure, resize and remove it.
    <Card
      className={cn(
        "group/widget relative flex flex-col transition-shadow",
        spanClasses[widget.span],
        rowsClasses[widget.rows],
        // No `touch-none`: the touch sensor's 200ms hold already separates a
        // drag from a scroll, and blocking touch-action would strand a phone
        // mid-board with nothing to scroll.
        isEditing &&
          "outline-primary/40 cursor-grab outline-2 outline-offset-2 outline-dashed active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...(isEditing ? listeners : {})}
    >
      {isEditing && (
        /* Names the widget while you are arranging it, without taking a row of
           layout - the content underneath is dimmed and inert. It doubles as the
           card's drag handle: this is what a keyboard tabs to and what a screen
           reader is told about, while a pointer can still grab the card itself.
           Its keydown reaches the card's listeners by bubbling. */
        <button
          aria-label={t("drag_handle", { title: widget.title })}
          className="bg-popover text-popover-foreground focus-visible:ring-ring absolute inset-s-3 top-3 z-10 cursor-grab rounded-md border px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-opacity group-focus-within/widget:opacity-100 group-hover/widget:opacity-100 focus-visible:ring-2 active:cursor-grabbing"
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
        >
          {widget.title}
        </button>
      )}

      {/* Everything an admin does to a card - configure it, resize it, take it
          off - belongs to edit mode, so the corner is empty until then. */}
      {isEditing && (
        // Stops a press on these buttons from turning into a card drag.
        <div
          className="absolute inset-e-3 top-3 z-10 flex items-center gap-1"
          onKeyDown={event => event.stopPropagation()}
          onPointerDown={event => event.stopPropagation()}
        >
          {!!widget.settingsContent && (
            <WidgetSettingsDialog onSaved={onSettingsSaved} widget={widget} />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={t("size.title")}
                  size="icon-sm"
                  variant="secondary"
                />
              }
            >
              <Maximize2Icon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("size.title")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                onValueChange={value =>
                  onResize(
                    widget.instanceId,
                    Number(value) as AdminDashboardWidgetSpan,
                  )
                }
                value={String(widget.span)}
              >
                {SPANS.filter(span => span >= widget.minSpan).map(span => (
                  <DropdownMenuRadioItem key={span} value={String(span)}>
                    {t(SIZE_LABELS[span])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            aria-label={t("remove", { title: widget.title })}
            onClick={() => onRemove(widget.instanceId)}
            size="icon-sm"
            variant="secondary"
          >
            <XIcon />
          </Button>
        </div>
      )}

      <WidgetCardContent isEditing={isEditing} widget={widget} />
    </Card>
  );
};
