"use client";

import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { LayoutGridIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type { AdminDashboardWidgetSpan } from "../widgets/types";

import { useDashboardBoard } from "./board-provider";
import { DropPlaceholder } from "./drop-placeholder";
import { DashboardPanelActions } from "./edit-actions";
import { gridClasses } from "./span-classes";
import { WidgetCard } from "./widget-card";
import { WidgetPanel } from "./widget-panel";

export const DashboardGrid = () => {
  const t = useTranslations("admin.dashboard.widgets");
  const {
    available,
    dispatch,
    isEditing,
    placed,
    refreshWidget,
    setIsEditing,
  } = useDashboardBoard();

  return (
    <>
      {placed.length === 0 && !isEditing ? (
        <Empty className="border-2">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGridIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty_title")}</EmptyTitle>
            <EmptyDescription>{t("empty_desc")}</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setIsEditing(true)} size="sm">
            <PencilIcon />
            {t("edit")}
          </Button>
        </Empty>
      ) : (
        <SortableContext
          items={placed.map(widget => widget.instanceId)}
          strategy={rectSortingStrategy}
        >
          <div className={gridClasses}>
            {placed.map(widget => (
              <WidgetCard
                isEditing={isEditing}
                key={widget.instanceId}
                onRemove={id => dispatch({ type: "remove", id })}
                onResize={(id, span: AdminDashboardWidgetSpan) =>
                  dispatch({ type: "resize", id, span })
                }
                onSettingsSaved={() => refreshWidget(widget.instanceId)}
                widget={widget}
              />
            ))}

            {isEditing && <DropPlaceholder isEmpty={placed.length === 0} />}
          </div>
        </SortableContext>
      )}

      <WidgetPanel
        actions={<DashboardPanelActions />}
        isOpen={isEditing}
        widgets={available}
      />
    </>
  );
};
