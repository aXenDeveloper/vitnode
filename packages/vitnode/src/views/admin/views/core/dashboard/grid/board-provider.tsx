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
import { DROP_END_ID } from "./drop-placeholder";
import { dashboardLayoutReducer, isLayoutDirty } from "./layout-reducer";
import { panelWidgetId } from "./panel-drag-id";
import { saveDashboardLayoutMutation } from "./save-layout.server";
import { WidgetCardContent } from "./widget-card";

interface DashboardBoardContextProps {
  /** Widgets the admin owns but has not placed - the panel's contents. */
  available: DashboardWidgetOption[];
  dispatch: React.Dispatch<DashboardLayoutAction>;
  /** True once the admin has changed something worth saving. */
  isDirty: boolean;
  isEditing: boolean;
  /** A save is in flight. */
  isPending: boolean;
  /**
   * Says a widget wrote its settings while the board was being edited. Those
   * go straight to the server, but the cards around them were rendered before
   * that, so the board has to reload once the admin is done arranging it.
   */
  markSettingsSaved: () => void;
  /** Drops the admin's edits and leaves edit mode. */
  onCancel: () => void;
  onSave: () => void;
  /** Widgets on the board, in order, each with its rendered content. */
  placed: DashboardWidgetView[];
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

interface DashboardBoardProviderProps {
  /** Every widget this admin may see, already rendered on the server. */
  catalog: DashboardWidgetCatalogEntry[];
  children: React.ReactNode;
  /** Server-rendered output per placed copy, keyed by its instance id. */
  content: Record<string, React.ReactNode>;
  layout: DashboardLayoutItem[];
  /** Stored ids this board speaks for - see `zodDashboardLayout`. */
  managedIds: string[];
  /** Same, for the settings form behind each card's gear. */
  settingsContent: Record<string, React.ReactNode>;
}

export const DashboardBoardProvider = ({
  catalog,
  children,
  content,
  layout,
  managedIds,
  settingsContent,
}: DashboardBoardProviderProps) => {
  const t = useTranslations("admin.dashboard.widgets");
  const router = useRouter();

  const [isEditing, setIsEditing] = React.useState(false);
  const [activeId, setActiveId] = React.useState<null | string>(null);
  const [isPending, startTransition] = React.useTransition();
  const [items, dispatch] = React.useReducer(dashboardLayoutReducer, layout);

  // The server owns the layout; re-sync whenever it hands us a new one.
  const [syncedLayout, setSyncedLayout] = React.useState(layout);
  if (syncedLayout !== layout) {
    setSyncedLayout(layout);
    dispatch({ type: "reset", state: layout });
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

        return [
          {
            ...widget,
            instanceId: item.id,
            span: item.span,
            rows: item.rows,
            contentKey: JSON.stringify(item.settings ?? {}),

            // A copy dragged in during this edit has no output of its own yet -
            // the catalog's stand-in carries it until the next save.
            content: content[item.id] ?? widget.content,
            settingsContent: settingsContent[item.id] ?? widget.settingsContent,
          },
        ];
      }),
    [items, catalogById, content, settingsContent],
  );

  const available = React.useMemo<DashboardWidgetOption[]>(() => {
    const used = new Set(items.map(item => widgetIdOf(item.id)));

    return (
      catalog
        // A widget that may be placed repeatedly never leaves the panel.
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
        }))
    );
  }, [catalog, items]);

  const sensors = useSensors(
    // A short threshold keeps clicks inside a widget working as clicks.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Hold-to-drag on touch, so the page still scrolls normally.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // What the drag overlay shows. A card being rearranged is a placed copy; a
  // row dragged out of the panel is only a catalog entry so far.
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

  // Settings are written the moment a widget's dialog saves them, so they
  // outlive a cancel - only the cards' server-rendered output is behind.
  const settingsSavedRef = React.useRef(false);
  const markSettingsSaved = React.useCallback(() => {
    settingsSavedRef.current = true;
  }, []);

  const onCancel = () => {
    dispatch({ type: "reset", state: layout });
    setIsEditing(false);

    if (settingsSavedRef.current) {
      settingsSavedRef.current = false;
      router.refresh();
    }
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
      settingsSavedRef.current = false;
      toast.success(t("saved_title"), { description: t("saved_desc") });
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
        markSettingsSaved,
        onCancel,
        onSave,
        placed,
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
