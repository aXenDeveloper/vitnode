import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { LayoutGridIcon, PencilIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { useDashboardBoard } from "./board-context";
import { DropPlaceholder, IncomingPlaceholder } from "./drop-placeholder";
import { DashboardPanelActions } from "./edit-actions";
import { INCOMING_ID } from "./incoming";
import { gridClasses } from "./span-classes";
import { WidgetCard } from "./widget-card";
import { WidgetPanel } from "./widget-panel";
import { WidgetPropertiesPanel } from "./widget-properties";

export const DashboardGrid = () => {
  const t = useTranslations("admin.dashboard.widgets");
  const {
    addWidget,
    arrivingId,
    available,
    dispatch,
    gridRef,
    incoming,
    isEditing,
    placed,
    select,
    selected,
    setIsEditing,
  } = useDashboardBoard();

  const placedIds = placed.map(widget => widget.instanceId);
  const sortableIds =
    incoming === null
      ? placedIds
      : placedIds.toSpliced(incoming.index, 0, INCOMING_ID);
  const incomingSlot =
    incoming === null ? null : (
      <IncomingPlaceholder key={INCOMING_ID} widget={incoming.widget} />
    );

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
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
          <div className={gridClasses} ref={gridRef}>
            {placed.map((widget, index) => (
              <React.Fragment key={widget.instanceId}>
                {incoming?.index === index ? incomingSlot : null}
                <WidgetCard
                  isArriving={widget.instanceId === arrivingId}
                  isEditing={isEditing}
                  isSelected={widget.instanceId === selected?.instanceId}
                  onRemove={id => dispatch({ type: "remove", id })}
                  onResize={(id, size) =>
                    dispatch({ type: "resize", id, ...size })
                  }
                  onSelect={select}
                  widget={widget}
                />
              </React.Fragment>
            ))}

            {incoming !== null && incoming.index >= placed.length
              ? incomingSlot
              : null}

            {isEditing && (
              <DropPlaceholder
                isEmpty={placed.length === 0 && incoming === null}
              />
            )}
          </div>
        </SortableContext>
      )}

      <WidgetPanel
        actions={<DashboardPanelActions />}
        isOpen={isEditing}
        onAdd={addWidget}
        properties={
          selected === null ? null : (
            <WidgetPropertiesPanel
              key={selected.instanceId}
              widget={selected}
            />
          )
        }
        widgets={available}
      />
    </>
  );
};
