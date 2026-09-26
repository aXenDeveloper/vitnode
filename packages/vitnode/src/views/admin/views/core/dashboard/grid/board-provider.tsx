import type {
  Active,
  Announcements,
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Card } from "@/components/ui/card";
import {
  DRAG_OVERLAY_LIFT_CLASS,
  DRAG_OVERLAY_LIFT_STYLE,
  LIFTED_DROP_ANIMATION,
} from "@/lib/dnd/drag-motion";
import { revealWhenRendered } from "@/lib/dnd/reveal";
import { FinePointerSensor } from "@/lib/dnd/sensors";

import type { DashboardActions } from "../widgets/dashboard-actions";
import type {
  DashboardLayoutItem,
  DashboardWidgetCatalogEntry,
  DashboardWidgetOption,
  DashboardWidgetView,
} from "../widgets/types";
import type { DashboardIncomingWidget } from "./board-context";
import type { LayoutSnapshot } from "./layout-flip";
import type { DashboardLayoutAction } from "./layout-reducer";

import { nextInstanceId, widgetIdOf } from "../widgets/instance-id";
import { DashboardBoardContext } from "./board-context";
import { DROP_END_ID } from "./drop-placeholder";
import { nextIncomingIndex, pointsAtBoard } from "./incoming";
import { playLayoutFlip, snapshotLayout } from "./layout-flip";
import {
  dashboardLayoutReducer,
  isLayoutDirty,
  withSavedSettings,
} from "./layout-reducer";
import { panelWidgetId } from "./panel-drag-id";
import { WidgetCardContent } from "./widget-card";
import { WIDGET_OPTION_CARD_CLASS, WidgetOptionCardBody } from "./widget-panel";

const RefreshedWidgetContent = ({
  content,
}: {
  content: Promise<React.ReactNode>;
}): React.ReactNode => React.use(content);

const panelWidgetOf = (active: Active): DashboardWidgetOption | undefined =>
  active.data.current?.fromPanel === true
    ? (active.data.current.widget as DashboardWidgetOption | undefined)
    : undefined;

const PICK_UP_WITH_SPACE = {
  cancel: ["Escape"],
  end: ["Space", "Enter"],
  start: ["Space"],
};

const boardCollision: CollisionDetection = args => {
  const pointer = args.pointerCoordinates;

  if (!panelWidgetOf(args.active) || pointer === null) {
    return closestCenter(args);
  }

  return pointsAtBoard({ pointer, targets: [...args.droppableRects.values()] })
    ? closestCenter(args)
    : [];
};

interface DashboardBoardProviderProps {
  actions: DashboardActions;
  catalog: DashboardWidgetCatalogEntry[];
  children: React.ReactNode;
  content: Record<string, React.ReactNode>;
  layout: DashboardLayoutItem[];
  managedIds: string[];
}

export const DashboardBoardProvider = ({
  actions,
  catalog,
  children,
  content,
  layout,
  managedIds,
}: DashboardBoardProviderProps) => {
  const t = useTranslations("admin.dashboard.widgets");
  const reduceMotion = useReducedMotion();

  const [isEditing, setIsEditing] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<null | string>(null);
  const [activeId, setActiveId] = React.useState<null | string>(null);
  const [incoming, setIncoming] =
    React.useState<DashboardIncomingWidget | null>(null);
  const [arrivingId, setArrivingId] = React.useState<null | string>(null);
  const [addedFromPanel, setAddedFromPanel] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [items, dispatch] = React.useReducer(dashboardLayoutReducer, layout);
  const [refreshed, setRefreshed] = React.useState<
    Record<string, { content: Promise<React.ReactNode>; revision: number }>
  >({});

  const [syncedLayout, setSyncedLayout] = React.useState(layout);
  if (syncedLayout !== layout) {
    setSyncedLayout(layout);
    dispatch({
      type: "reset",
      state: isLayoutDirty(items, syncedLayout)
        ? withSavedSettings(items, layout)
        : layout,
    });
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
    useSensor(FinePointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: PICK_UP_WITH_SPACE,
    }),
  );

  const gridRef = React.useRef<HTMLDivElement>(null);
  const flipFromRef = React.useRef<LayoutSnapshot | null>(null);

  const dispatchAnimated = React.useCallback(
    (action: DashboardLayoutAction) => {
      flipFromRef.current = reduceMotion
        ? null
        : snapshotLayout(gridRef.current);
      dispatch(action);
    },
    [reduceMotion],
  );

  React.useLayoutEffect(() => {
    playLayoutFlip(gridRef.current, flipFromRef.current);
    flipFromRef.current = null;
  }, [items]);

  const itemIds = items.map(item => item.id);
  const selected =
    placed.find(widget => widget.instanceId === selectedId) ?? null;
  if (selectedId !== null && selected === null) setSelectedId(null);

  const select = React.useCallback((instanceId: null | string) => {
    setSelectedId(instanceId);
    if (instanceId !== null) revealWhenRendered("[data-dashboard-properties]");
  }, []);

  const setEditing = (editing: boolean) => {
    setIsEditing(editing);
    if (!editing) setSelectedId(null);
  };
  const activeView = placed.find(widget => widget.instanceId === activeId);
  const activePanelWidget = activeId
    ? catalogById.get(panelWidgetId(activeId) ?? "")
    : undefined;

  const titleOf = (id: string): string =>
    placed.find(widget => widget.instanceId === id)?.title ??
    catalogById.get(panelWidgetId(id) ?? widgetIdOf(id))?.title ??
    id;

  const landingOf = (
    active: Active,
    overId: null | string,
  ): null | { position: number; total: number } => {
    if (panelWidgetOf(active)) {
      const index = nextIncomingIndex({
        current: incoming?.index ?? null,
        endId: DROP_END_ID,
        itemIds,
        overId,
      });

      return index === null
        ? null
        : { position: index + 1, total: itemIds.length + 1 };
    }

    const to =
      overId === DROP_END_ID
        ? itemIds.length - 1
        : overId === null
          ? -1
          : itemIds.indexOf(overId);

    return to === -1 ? null : { position: to + 1, total: itemIds.length };
  };

  const addAt = (widget: DashboardWidgetOption, index?: number) => {
    const instanceId = nextInstanceId(widget.id, itemIds);

    dispatchAnimated({ type: "add", widget, index });
    setArrivingId(instanceId);
    revealWhenRendered(`[data-dashboard-widget="${CSS.escape(instanceId)}"]`);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setAddedFromPanel(false);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const widget = panelWidgetOf(active);
    if (!widget) return;

    setIncoming(current => {
      const index = nextIncomingIndex({
        current: current?.index ?? null,
        endId: DROP_END_ID,
        itemIds,
        overId: over ? String(over.id) : null,
      });

      if (index === null) return null;
      if (current?.index === index) return current;

      return { index, widget };
    });
  };

  const onDragCancel = () => {
    setActiveId(null);
    setIncoming(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setIncoming(null);

    const overId = over ? String(over.id) : null;
    const widget = panelWidgetOf(active);

    if (widget) {
      const index = nextIncomingIndex({
        current: incoming?.index ?? null,
        endId: DROP_END_ID,
        itemIds,
        overId,
      });
      if (index === null) return;

      setAddedFromPanel(true);
      addAt(widget, index);

      return;
    }

    if (overId === null) return;

    const from = itemIds.indexOf(String(active.id));
    if (from === -1) return;

    const to =
      overId === DROP_END_ID ? itemIds.length - 1 : itemIds.indexOf(overId);
    if (to === -1) return;

    dispatch({ type: "move", index: from, toIndex: to });
  };

  const announcements: Announcements = {
    onDragCancel: ({ active }) =>
      t("dnd.cancelled", { title: titleOf(String(active.id)) }),
    onDragEnd: ({ active, over }) => {
      const title = titleOf(String(active.id));
      const landing = landingOf(active, over ? String(over.id) : null);

      if (landing === null) return t("dnd.not_dropped", { title });

      return t(panelWidgetOf(active) ? "dnd.added" : "dnd.moved", {
        title,
        ...landing,
      });
    },
    onDragOver: ({ active, over }) => {
      const landing = landingOf(active, over ? String(over.id) : null);

      return landing === null
        ? undefined
        : t("dnd.over", { title: titleOf(String(active.id)), ...landing });
    },
    onDragStart: ({ active }) =>
      t("dnd.picked_up", { title: titleOf(String(active.id)) }),
  };

  const refreshWidget = React.useCallback(
    (instanceId: string) => {
      const content = actions
        .loadWidgetContent(instanceId)
        .catch(() => (
          <p className="text-destructive text-sm">{t("refresh_error")}</p>
        ));

      setRefreshed(current => ({
        ...current,
        [instanceId]: {
          content,
          revision: (current[instanceId]?.revision ?? 0) + 1,
        },
      }));
    },
    [actions, t],
  );

  const onCancel = () => {
    dispatchAnimated({ type: "reset", state: layout });
    setEditing(false);
  };

  const onSave = () => {
    startTransition(async () => {
      const res = await actions.saveLayout({
        managed: managedIds,
        widgets: items,
      });

      if (res?.error) {
        toast.error(t("error_title"), { description: t("error_desc") });

        return;
      }

      setEditing(false);
    });
  };

  return (
    <DashboardBoardContext.Provider
      value={{
        actions,
        addWidget: widget => {
          addAt(widget);
        },
        arrivingId,
        available,
        dispatch: dispatchAnimated,
        gridRef,
        incoming,
        isDirty: isLayoutDirty(items, layout),
        isEditing,
        isPending,
        onCancel,
        onSave,
        placed,
        refreshWidget,
        select,
        selected,
        setIsEditing: setEditing,
      }}
    >
      <DndContext
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("dnd.instructions") },
        }}
        collisionDetection={boardCollision}
        id="vitnode-dashboard-board"
        modifiers={[restrictToWindowEdges]}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        sensors={sensors}
      >
        <div
          className={cn(
            "transition-[padding] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
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

        <DragOverlay
          dropAnimation={
            reduceMotion || addedFromPanel ? null : LIFTED_DROP_ANIMATION
          }
        >
          {activeView ? (
            <Card
              className={cn(
                "ring-primary/40 flex flex-col",
                DRAG_OVERLAY_LIFT_CLASS,
              )}
              style={DRAG_OVERLAY_LIFT_STYLE}
            >
              <WidgetCardContent isEditing widget={activeView} />
            </Card>
          ) : activePanelWidget ? (
            <div
              className={cn(WIDGET_OPTION_CARD_CLASS, DRAG_OVERLAY_LIFT_CLASS)}
              style={DRAG_OVERLAY_LIFT_STYLE}
            >
              <WidgetOptionCardBody widget={activePanelWidget} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DashboardBoardContext.Provider>
  );
};
