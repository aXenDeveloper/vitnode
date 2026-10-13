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
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { cn } from "cn";
import { Columns2Icon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import type {
  AnyBlockInstance,
  BlockIcon,
  BlockRegistry,
  RegisteredBlock,
} from "../../blocks/types";
import type {
  LayoutFlipTarget,
  LayoutSnapshot,
} from "../../lib/dnd/layout-flip";
import type {
  AreaCatalogEntry,
  BlockCatalogEntry,
} from "../block-picker/catalog";
import type { EditorContainerRef, EditorZoneState } from "../state/types";
import type { EditorDndContextValue } from "./context";
import type {
  DropPlacement,
  EditorDragSource,
  EditorDropAxis,
  EditorDropEdge,
  EditorDropIndicator,
  EditorDropRejection,
  ResolvedDrop,
} from "./resolve-drop";

import { isBlockAreaInstance } from "../../blocks/area";
import { parseBlockId } from "../../blocks/namespace";
import { getDefaultBlockRegistry } from "../../blocks/registry";
import { DragLift } from "../../lib/dnd/drag-lift";
import {
  DRAG_OVERLAY_LIFT_CLASS,
  LIFTED_DROP_ANIMATION,
} from "../../lib/dnd/drag-motion";
import { playLayoutFlip, snapshotLayout } from "../../lib/dnd/layout-flip";
import { FinePointerSensor } from "../../lib/dnd/sensors";
import { BlockGlyph } from "../block-picker/block-glyph";
import { toBlockCatalogEntry } from "../block-picker/catalog";
import {
  BLOCK_CATALOG_CARD_CLASS,
  BlockCatalogEntryCard,
} from "../block-picker/entry-card";
import { useVisualEditor } from "../context";
import { dropCapacity } from "../state/bounds";
import { targetCapabilities } from "../state/capabilities";
import { containerNodes } from "../state/reducer";
import { EditableBlockBody } from "../zones/block-body";
import { DND_REJECTION_LABELS } from "../zones/rejection-labels";
import { zoneDisplayName } from "../zones/zone-name";
import { EditorDndContext } from "./context";
import { dropSlotFor, sameSlot } from "./drop-slot";
import {
  decideDrop,
  dropEdgeFor,
  dropPlacement,
  isCatalogSource,
  isContainerDroppableId,
  preferInnerCollisions,
  readDragSource,
  readDropTarget,
} from "./resolve-drop";

const PICK_UP_WITH_SPACE = {
  cancel: ["Escape"],
  end: ["Space", "Enter"],
  start: ["Space"],
};

const isRtl = (): boolean =>
  typeof document !== "undefined" && document.dir === "rtl";

type DragOverlayPreview =
  | { area: AreaCatalogEntry; kind: "catalog-area" }
  | { entry: BlockCatalogEntry; kind: "catalog-block" }
  | {
      entry: RegisteredBlock | undefined;
      icon: BlockIcon | undefined;
      index: number;
      instance: AnyBlockInstance | undefined;
      kind: "existing-block";
      name: string;
      namespace: null | string;
    }
  | { kind: "existing-area"; name: string };

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

const EDITOR_NODES: LayoutFlipTarget = {
  keyOf: node =>
    node.dataset.blockId === undefined
      ? node.dataset.areaId === undefined
        ? undefined
        : `area:${node.dataset.areaId}`
      : `block:${node.dataset.blockId}`,
  selector: "[data-block-id], [data-area-id]",
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
  const { dispatch, insertArea, insertBlock, state } = useVisualEditor();
  const [dragging, setDragging] = useState<EditorDragSource | null>(null);
  const [dropIndicator, setDropIndicator] =
    useState<EditorDropIndicator | null>(null);
  const pointerRef = useRef<null | { x: number; y: number }>(null);
  const reduceMotion = useReducedMotion();
  const [dragHeight, setDragHeight] = useState(0);
  const [skipDropAnimation, setSkipDropAnimation] = useState(false);
  const flipFromRef = useRef<LayoutSnapshot | null>(null);
  const dropSlot = dropSlotFor(dragging, dropIndicator);

  const snapshotForSlot = (next: EditorDropIndicator | null) => {
    if (reduceMotion || sameSlot(dropSlot, next)) return;
    flipFromRef.current ??= snapshotLayout(document.body, EDITOR_NODES);
  };

  useLayoutEffect(() => {
    playLayoutFlip(document.body, flipFromRef.current, EDITOR_NODES);
    flipFromRef.current = null;
  });

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

  const collisionDetection = useCallback<CollisionDetection>(args => {
    pointerRef.current = args.pointerCoordinates ?? null;

    const pointer = pointerWithin(args);

    return preferInnerCollisions(
      pointer.length > 0 ? pointer : rectIntersection(args),
      readDragSource(args.active.data.current),
    );
  }, []);

  const overlay = useMemo<DragOverlayPreview | null>(() => {
    if (!dragging) return null;

    if (dragging.kind === "catalog-area") {
      return {
        area: { description: t("area.description"), name: t("area.name") },
        kind: "catalog-area",
      };
    }

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
              icon: undefined,
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

    const instance = containerNodes(state, dragging.container)?.find(
      node => node.id === dragging.nodeId,
    );

    return {
      entry,
      icon: entry?.definition.icon,
      index: dragging.index,
      instance:
        instance === undefined || isBlockAreaInstance(instance)
          ? undefined
          : instance,
      kind: "existing-block",
      name: entry?.definition.name ?? entry?.definition.id ?? dragging.type,
      namespace: parseBlockId(dragging.type)?.namespace ?? null,
    };
  }, [dragging, state, t]);

  const showsOwnSpot =
    dragging !== null &&
    !isCatalogSource(dragging) &&
    dropIndicator !== null &&
    dragging.container.zoneId === dropIndicator.zoneId &&
    dragging.container.areaId === dropIndicator.areaId;

  const slotLabel = useMemo<EditorDndContextValue["slotLabel"]>(() => {
    if (overlay === null) return null;
    if (overlay.kind === "catalog-area") {
      return { icon: <Columns2Icon />, name: overlay.area.name };
    }
    if (overlay.kind === "catalog-block") {
      return {
        icon: <BlockGlyph icon={overlay.entry.icon} />,
        name: overlay.entry.name,
      };
    }
    if (overlay.kind === "existing-area") {
      return { icon: <Columns2Icon />, name: overlay.name };
    }

    return { icon: <BlockGlyph icon={overlay.icon} />, name: overlay.name };
  }, [overlay]);

  const dnd = useMemo<EditorDndContextValue>(
    () => ({
      dragging,
      dragHeight,
      dropIndicator: dropSlot !== null || showsOwnSpot ? null : dropIndicator,
      dropSlot,
      slotLabel,
    }),
    [dragging, dragHeight, dropIndicator, dropSlot, showsOwnSpot, slotLabel],
  );

  const dragName = useCallback(
    (source: EditorDragSource): string => {
      if (source.kind === "catalog-area" || source.kind === "existing-area") {
        return t("area.name");
      }

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

      const axisOf = (container: EditorContainerRef): EditorDropAxis => {
        if (container.areaId === null) return "vertical";

        const area = containerNodes(state, {
          areaId: null,
          zoneId: container.zoneId,
        })?.find(node => node.id === container.areaId);

        return area && isBlockAreaInstance(area) && area.layout.columns > 1
          ? "horizontal"
          : "vertical";
      };

      const unplaced = readDropTarget(over.data.current, null);
      const axis = unplaced === null ? "vertical" : axisOf(unplaced.container);

      const edgeFor = (): EditorDropEdge | null => {
        const pointer = pointerRef.current;

        if (pointer === null) return null;
        if (isContainerDroppableId(String(over.id))) return null;
        if (
          unplaced !== null &&
          !isCatalogSource(source) &&
          source.container.zoneId === unplaced.container.zoneId &&
          source.container.areaId === unplaced.container.areaId
        ) {
          return null;
        }

        return dropEdgeFor({
          axis,
          pointerX: pointer.x,
          pointerY: pointer.y,
          rect: over.rect,
          rtl: isRtl(),
        });
      };

      const target = readDropTarget(over.data.current, edgeFor());
      const nodes =
        target === null ? null : containerNodes(state, target.container);
      if (!target || !nodes) return outside;

      const { rejection, resolved } = decideDrop({
        capabilities: targetCapabilities(state, target.container),
        capacity: dropCapacity(state, {
          from: isCatalogSource(source) ? null : source.container.zoneId,
          to: target.container.zoneId,
        }),
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
                axis,
                container: target.container,
                nodeIds: nodes.map(node => node.id),
                overNodeId: target.nodeId,
                resolved,
              }),
        rejection,
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

      const zone = zoneDisplayName(plan.container.zoneId);
      if (plan.rejection !== null) {
        return t(DND_REJECTION_LABELS[plan.rejection], { name, zone });
      }
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
                zone: zoneDisplayName(plan.container.zoneId),
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
    pointerRef.current = null;
  };

  const showIndicator = (active: Active, over: null | Over) => {
    const next = planDrop(active, over)?.placement?.indicator ?? null;
    snapshotForSlot(dropSlotFor(dragging, next));
    const height = active.rect.current.initial?.height ?? 0;
    if (height !== dragHeight) setDragHeight(height);

    setDropIndicator(current =>
      sameIndicator(current, next) ? current : next,
    );
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragging(readDragSource(active.data.current));
    setDragHeight(active.rect.current.initial?.height ?? 0);
    setSkipDropAnimation(false);
  };

  const onDragMove = ({ active, over }: DragMoveEvent) => {
    showIndicator(active, over);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    showIndicator(active, over);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const plan = planDrop(active, over);
    const resolved = plan?.resolved ?? null;

    setSkipDropAnimation(
      resolved !== null && plan !== null && isCatalogSource(plan.source),
    );
    snapshotForSlot(null);
    reset();
    if (!resolved) return;

    if (resolved.kind === "insert-area") {
      insertArea({ index: resolved.toIndex, zoneId: resolved.to.zoneId });

      return;
    }

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

        <DragOverlay
          dropAnimation={
            reduceMotion || skipDropAnimation ? null : LIFTED_DROP_ANIMATION
          }
        >
          {overlay === null ? null : overlay.kind === "catalog-area" ||
            overlay.kind === "catalog-block" ? (
            // The card the pointer picked up, at the size it was picked up at.
            <DragLift>
              <div
                className={cn(
                  BLOCK_CATALOG_CARD_CLASS,
                  "size-full",
                  DRAG_OVERLAY_LIFT_CLASS,
                )}
              >
                <BlockCatalogEntryCard
                  entry={
                    overlay.kind === "catalog-area"
                      ? overlay.area
                      : overlay.entry
                  }
                  icon={
                    overlay.kind === "catalog-area" ? (
                      <Columns2Icon />
                    ) : (
                      <BlockGlyph icon={overlay.entry.icon} />
                    )
                  }
                />
              </div>
            </DragLift>
          ) : (
            // Sized to the node it was picked up from, so what follows the
            // pointer keeps the footprint the drop is about to give it.
            <DragLift>
              {overlay.kind === "existing-block" &&
              overlay.instance !== undefined ? (
                <div
                  className={cn(
                    "bg-background text-foreground size-full overflow-hidden rounded-md border",
                    DRAG_OVERLAY_LIFT_CLASS,
                  )}
                >
                  <div className="pointer-events-none" inert>
                    <EditableBlockBody
                      entry={overlay.entry}
                      index={overlay.index}
                      instance={overlay.instance}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "bg-popover text-popover-foreground flex h-full w-full items-start gap-3 overflow-hidden rounded-lg border p-3",
                    DRAG_OVERLAY_LIFT_CLASS,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm [&_svg]:size-4"
                  >
                    {overlay.kind === "existing-area" ? (
                      <Columns2Icon />
                    ) : (
                      <BlockGlyph icon={overlay.icon} />
                    )}
                  </span>
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
                </div>
              )}
            </DragLift>
          )}
        </DragOverlay>
      </DndContext>
    </EditorDndContext.Provider>
  );
};
