import type {
  Active,
  Announcements,
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  Over,
} from "@dnd-kit/core";
import type { ReactElement, ReactNode } from "react";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVerticalIcon, LayoutGridIcon, PlusIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import type { BlockRegistry, RegisteredBlock } from "../../blocks/types";
import type { BlockCatalogEntry } from "../block-picker/catalog";
import type { EditorContainerRef, EditorZoneState } from "../state/types";
import type { EditorDndContextValue } from "./context";
import type {
  DropPlacement,
  EditorDragSource,
  EditorDropEdge,
  EditorDropIndicator,
  EditorDropRejection,
  ResolvedDrop,
} from "./resolve-drop";

import { parseBlockId } from "../../blocks/namespace";
import { getDefaultBlockRegistry } from "../../blocks/registry";
import { toBlockCatalogEntry } from "../block-picker/catalog";
import { BlockCatalogEntryCard } from "../block-picker/entry-card";
import { useVisualEditor } from "../context";
import { containerNodes } from "../state/reducer";
import { EditorDndContext } from "./context";
import {
  dropEdgeFor,
  dropPlacement,
  dropRejection,
  isContainerDroppableId,
  preferInnerCollisions,
  readDragSource,
  readDropTarget,
  resolveDrop,
} from "./resolve-drop";

type DragOverlayPreview =
  | { entry: BlockCatalogEntry; kind: "catalog-block" }
  | { kind: "existing-area"; name: string }
  | { kind: "existing-block"; name: string; namespace: null | string };

interface EditorDragPlan {
  container: EditorContainerRef | null;
  placement: DropPlacement | null;
  rejection: EditorDropRejection | null;
  resolved: null | ResolvedDrop;
  source: EditorDragSource;
}

const findRegisteredBlock = (
  zones: Readonly<Record<string, EditorZoneState>>,
  type: string,
): RegisteredBlock | undefined => {
  for (const zone of Object.values(zones)) {
    const found = zone.registry?.get(type);
    if (found) return found;
  }

  const fallback: BlockRegistry | undefined = getDefaultBlockRegistry();

  return fallback?.get(type);
};

const sameIndicator = (
  left: EditorDropIndicator | null,
  right: EditorDropIndicator | null,
): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.nodeId === right.nodeId &&
    left.edge === right.edge &&
    left.areaId === right.areaId &&
    left.zoneId === right.zoneId);

export const EditorDndProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch, insertBlock, state } = useVisualEditor();
  const [dragging, setDragging] = useState<EditorDragSource | null>(null);
  const [dropIndicator, setDropIndicator] =
    useState<EditorDropIndicator | null>(null);
  const pointerYRef = useRef<null | number>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const collisionDetection = useCallback<CollisionDetection>(args => {
    pointerYRef.current = args.pointerCoordinates?.y ?? null;

    const pointer = pointerWithin(args);

    return preferInnerCollisions(
      pointer.length > 0 ? pointer : rectIntersection(args),
    );
  }, []);

  const dnd = useMemo<EditorDndContextValue>(
    () => ({
      dragging,
      dropIndicator,
    }),
    [dragging, dropIndicator],
  );

  const overlay = useMemo<DragOverlayPreview | null>(() => {
    if (!dragging) return null;

    if (dragging.kind === "existing-area") {
      return { kind: "existing-area", name: t("area.name") };
    }

    if (dragging.kind === "catalog-block") {
      const found = findRegisteredBlock(state.zones, dragging.type);

      return {
        entry: found
          ? toBlockCatalogEntry(found)
          : {
              description: undefined,
              name: dragging.type,
              namespace: parseBlockId(dragging.type)?.namespace ?? "",
              type: dragging.type,
            },
        kind: "catalog-block",
      };
    }

    const entry = state.zones[dragging.container.zoneId]?.registry?.get(
      dragging.type,
    );

    return {
      kind: "existing-block",
      name: entry?.definition.name ?? entry?.definition.id ?? dragging.type,
      namespace: parseBlockId(dragging.type)?.namespace ?? null,
    };
  }, [dragging, state.zones, t]);

  const dragName = useCallback(
    (source: EditorDragSource): string => {
      if (source.kind === "existing-area") return t("area.name");

      const found = findRegisteredBlock(state.zones, source.type);

      return found?.definition.name ?? found?.definition.id ?? source.type;
    },
    [state.zones, t],
  );

  const planDrop = useCallback(
    (active: Active, over: null | Over): EditorDragPlan | null => {
      const source = readDragSource(active.data.current);
      if (!source) return null;

      const outside: EditorDragPlan = {
        container: null,
        placement: null,
        rejection: null,
        resolved: null,
        source,
      };
      if (!over) return outside;

      const edgeFor = (): EditorDropEdge | null => {
        const pointerY = pointerYRef.current;

        if (pointerY === null) return null;
        if (isContainerDroppableId(String(over.id))) return null;

        return dropEdgeFor({ pointerY, rect: over.rect });
      };

      const target = readDropTarget(over.data.current, edgeFor());
      const nodes =
        target === null ? null : containerNodes(state, target.container);
      if (!target || !nodes) return outside;

      const allowedBlocks = state.zones[target.container.zoneId]?.allowedBlocks;
      const resolved = resolveDrop({
        allowedBlocks,
        source,
        target,
        targetNodeCount: nodes.length,
      });

      return {
        container: target.container,
        placement:
          resolved === null
            ? null
            : dropPlacement({
                container: target.container,
                nodeIds: nodes.map(node => node.id),
                overNodeId: target.nodeId,
                resolved,
              }),
        rejection: dropRejection({ allowedBlocks, source, target }),
        resolved,
        source,
      };
    },
    [state],
  );

  const announcements = useMemo<Announcements>(() => {
    const landing = (active: Active, over: null | Over): string | undefined => {
      if (over !== null && String(over.id) === String(active.id))
        return undefined;

      const plan = planDrop(active, over);
      if (!plan) return undefined;

      const name = dragName(plan.source);
      if (plan.container === null) return t("dnd.outside", { name });
      if (plan.rejection === "nested-area") return t("dnd.area_rejected");

      const zone = plan.container.zoneId;
      if (plan.rejection !== null) return t("dnd.rejected", { name, zone });
      if (!plan.placement) return t("dnd.unchanged", { name, zone });

      return t(plan.container.areaId === null ? "dnd.over" : "dnd.area_over", {
        name,
        position: plan.placement.position,
        total: plan.placement.total,
        zone,
      });
    };

    return {
      onDragCancel: ({ active }) => {
        const source = readDragSource(active.data.current);

        return t("dnd.cancelled", {
          name: source === null ? String(active.id) : dragName(source),
        });
      },
      onDragEnd: ({ active, over }) => {
        const plan = planDrop(active, over);
        if (!plan) return undefined;

        const name = dragName(plan.source);

        return plan.placement === null || plan.container === null
          ? t("dnd.not_dropped", { name })
          : t(
              plan.container.areaId === null
                ? "dnd.dropped"
                : "dnd.area_dropped",
              {
                name,
                position: plan.placement.position,
                total: plan.placement.total,
                zone: plan.container.zoneId,
              },
            );
      },
      onDragOver: ({ active, over }) => landing(active, over),
      onDragStart: ({ active }) => {
        const source = readDragSource(active.data.current);

        return t("dnd.picked_up", {
          name: source === null ? String(active.id) : dragName(source),
        });
      },
    };
  }, [dragName, planDrop, t]);

  const accessibility = useMemo(
    () => ({
      announcements,
      screenReaderInstructions: { draggable: t("dnd.instructions") },
    }),
    [announcements, t],
  );

  const reset = () => {
    setDragging(null);
    setDropIndicator(null);
    pointerYRef.current = null;
  };

  const showIndicator = (active: Active, over: null | Over) => {
    const next = planDrop(active, over)?.placement?.indicator ?? null;

    setDropIndicator(current =>
      sameIndicator(current, next) ? current : next,
    );
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragging(readDragSource(active.data.current));
  };

  const onDragMove = ({ active, over }: DragMoveEvent) => {
    showIndicator(active, over);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    showIndicator(active, over);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const resolved = planDrop(active, over)?.resolved ?? null;

    reset();
    if (!resolved) return;

    if (resolved.kind === "insert") {
      insertBlock({
        areaId: resolved.to.areaId,
        index: resolved.toIndex,
        type: resolved.type,
        zoneId: resolved.to.zoneId,
      });

      return;
    }

    dispatch({
      from: resolved.from,
      nodeId: resolved.nodeId,
      to: resolved.to,
      toIndex: resolved.toIndex,
      type: "move",
    });
  };

  return (
    <EditorDndContext.Provider value={dnd}>
      <DndContext
        accessibility={accessibility}
        collisionDetection={collisionDetection}
        id="vitnode-visual-editor"
        modifiers={[restrictToWindowEdges]}
        onDragCancel={reset}
        onDragEnd={onDragEnd}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        sensors={sensors}
      >
        {children}

        <DragOverlay>
          {overlay === null ? null : (
            <div className="bg-popover text-popover-foreground ring-primary flex max-w-64 cursor-grabbing items-start gap-2 rounded-lg border p-3 shadow-lg ring-2">
              {overlay.kind === "catalog-block" ? (
                <>
                  <PlusIcon
                    aria-hidden="true"
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  />
                  <BlockCatalogEntryCard entry={overlay.entry} />
                </>
              ) : (
                <>
                  {overlay.kind === "existing-area" ? (
                    <LayoutGridIcon
                      aria-hidden="true"
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    />
                  ) : (
                    <GripVerticalIcon
                      aria-hidden="true"
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm leading-relaxed font-medium">
                      {overlay.name}
                    </span>
                    {overlay.kind === "existing-block" &&
                    overlay.namespace !== null ? (
                      <span className="text-muted-foreground truncate text-xs leading-relaxed">
                        {overlay.namespace}
                      </span>
                    ) : null}
                  </span>
                </>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </EditorDndContext.Provider>
  );
};
