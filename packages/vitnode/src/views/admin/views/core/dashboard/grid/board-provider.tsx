"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import type {
  DashboardLayoutItem,
  DashboardWidgetCatalogEntry,
  DashboardWidgetOption,
  DashboardWidgetView,
} from "../widgets/types";
import type { DashboardLayoutAction } from "./layout-reducer";

import { widgetIdOf } from "../widgets/instance-id";
import { loadWidgetContentAction } from "../widgets/load-widget-content.server";
import { DROP_END_ID } from "./drop-placeholder";
import { dashboardLayoutReducer, isLayoutDirty } from "./layout-reducer";
import { panelWidgetId } from "./panel-drag-id";
import { saveDashboardLayoutMutation } from "./save-layout.server";
import { WidgetCardContent } from "./widget-card";

interface DashboardBoardContextProps {
  available: DashboardWidgetOption[];
  dispatch: React.Dispatch<DashboardLayoutAction>;
  isDirty: boolean;
  isEditing: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSave: () => void;
  placed: DashboardWidgetView[];
  refreshWidget: (instanceId: string) => void;
  setIsEditing: (isEditing: boolean) => void;
}

const DashboardBoardContext =
  React.createContext<DashboardBoardContextProps | null>(null);

export const useDashboardBoard = () => {
  const context = React.use(DashboardBoardContext);
  if (!context) {
    throw new Error(
      "useDashboardBoard must be used within a DashboardBoardProvider.",
    );
  }

  return context;
};

const RefreshedWidgetContent = ({
  content,
}: {
  content: Promise<React.ReactNode>;
}): React.ReactNode => React.use(content);

interface DashboardBoardProviderProps {
  catalog: DashboardWidgetCatalogEntry[];
  children: React.ReactNode;
  content: Record<string, React.ReactNode>;
  layout: DashboardLayoutItem[];
  managedIds: string[];
}

export const DashboardBoardProvider = ({
  catalog,
  children,
  content,
  layout,
  managedIds,
}: DashboardBoardProviderProps) => {
  const t = useTranslations("admin.dashboard.widgets");
  const router = useRouter();

  const [isEditing, setIsEditing] = React.useState(false);
  const [activeId, setActiveId] = React.useState<null | string>(null);
  const [isPending, startTransition] = React.useTransition();
  const [items, dispatch] = React.useReducer(dashboardLayoutReducer, layout);
  const [refreshed, setRefreshed] = React.useState<
    Record<string, { content: Promise<React.ReactNode>; revision: number }>
  >({});

  const [syncedLayout, setSyncedLayout] = React.useState(layout);
  if (syncedLayout !== layout) {
    setSyncedLayout(layout);
    dispatch({ type: "reset", state: layout });
    setRefreshed({});
  }

  const catalogById = React.useMemo(
    () => new Map(catalog.map(widget => [widget.id, widget])),
    [catalog],
  );

  const placed = React.useMemo(
    () =>
      items.flatMap<DashboardWidgetView>(item => {
        const widget = catalogById.get(widgetIdOf(item.id));
        if (!widget) return [];

        const refresh = refreshed[item.id];

        return [
          {
            ...widget,
            instanceId: item.id,
            span: item.span,
            rows: item.rows,
            contentKey: refresh
              ? `refresh:${refresh.revision}`
              : JSON.stringify(item.settings ?? {}),

            content: refresh ? (
              <RefreshedWidgetContent content={refresh.content} />
            ) : (
              (content[item.id] ?? widget.content)
            ),
          },
        ];
      }),
    [items, catalogById, content, refreshed],
  );

  const available = React.useMemo<DashboardWidgetOption[]>(() => {
    const used = new Set(items.map(item => widgetIdOf(item.id)));

    return catalog
      .filter(widget => !!widget.allowMultiple || !used.has(widget.id))
      .map(widget => ({
        id: widget.id,
        title: widget.title,
        desc: widget.desc,
        icon: widget.icon,
        category: widget.category,
        allowMultiple: widget.allowMultiple,
        minSpan: widget.minSpan,
        defaultSpan: widget.defaultSpan,
        defaultRows: widget.defaultRows,
      }));
  }, [catalog, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeView = placed.find(widget => widget.instanceId === activeId);
  const activeCatalogEntry =
    activeView ??
    (activeId ? catalogById.get(panelWidgetId(activeId) ?? "") : undefined);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const draggedId = String(active.id);
    const overId = String(over.id);

    if (active.data.current?.fromPanel === true) {
      const widget = active.data.current.widget as
        DashboardWidgetOption | undefined;
      if (!widget) return;

      const overIndex = items.findIndex(item => item.id === overId);
      dispatch({
        type: "add",
        widget,
        index: overIndex === -1 ? undefined : overIndex,
      });

      return;
    }

    const from = items.findIndex(item => item.id === draggedId);
    if (from === -1) return;

    const to =
      overId === DROP_END_ID
        ? items.length - 1
        : items.findIndex(item => item.id === overId);
    if (to === -1) return;

    dispatch({ type: "move", index: from, toIndex: to });
  };

  const refreshWidget = React.useCallback(
    (instanceId: string) => {
      const content = loadWidgetContentAction({ widgetId: instanceId }).catch(
        () => <p className="text-destructive text-sm">{t("refresh_error")}</p>,
      );

      setRefreshed(current => ({
        ...current,
        [instanceId]: {
          content,
          revision: (current[instanceId]?.revision ?? 0) + 1,
        },
      }));
    },
    [t],
  );

  const onCancel = () => {
    dispatch({ type: "reset", state: layout });
    setIsEditing(false);
  };

  const onSave = () => {
    startTransition(async () => {
      const res = await saveDashboardLayoutMutation({
        managed: managedIds,
        widgets: items,
      });

      if (res?.error) {
        toast.error(t("error_title"), { description: t("error_desc") });

        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  };

  return (
    <DashboardBoardContext.Provider
      value={{
        available,
        dispatch,
        isDirty: isLayoutDirty(items, layout),
        isEditing,
        isPending,
        onCancel,
        onSave,
        placed,
        refreshWidget,
        setIsEditing,
      }}
    >
      <DndContext
        collisionDetection={closestCenter}
        id="vitnode-dashboard-board"
        modifiers={[restrictToWindowEdges]}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
        onDragStart={(event: DragStartEvent) =>
          setActiveId(String(event.active.id))
        }
        sensors={sensors}
      >
        <div
          className={cn(
            "transition-[padding] duration-200 ease-linear",
            isEditing && "md:pe-(--dashboard-panel-width)",
          )}
          style={
            {
              "--dashboard-panel-width": "clamp(18rem, 26vw, 24rem)",
            } as React.CSSProperties
          }
        >
          {children}
        </div>

        <DragOverlay>
          {activeCatalogEntry ? (
            <Card className="ring-primary flex cursor-grabbing flex-col shadow-lg ring-2">
              <WidgetCardContent
                isEditing
                widget={{
                  ...activeCatalogEntry,
                  instanceId: activeView?.instanceId ?? activeCatalogEntry.id,
                  span: activeView?.span ?? activeCatalogEntry.defaultSpan,
                  rows: activeView?.rows ?? activeCatalogEntry.defaultRows,
                  contentKey: activeView?.contentKey ?? "{}",
                }}
              />
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DashboardBoardContext.Provider>
  );
};
