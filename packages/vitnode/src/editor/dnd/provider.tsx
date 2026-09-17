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
import { GripVerticalIcon, PlusIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import type { BlockRegistry, RegisteredBlock } from "../../blocks/types";
import type { BlockCatalogEntry } from "../block-picker/catalog";
import type { EditorZoneState } from "../state/types";
import type { EditorDndContextValue } from "./context";
import type {
  DropPlacement,
  EditorDragSource,
  EditorDropEdge,
  EditorDropIndicator,
  ResolvedDrop,
} from "./resolve-drop";

import { BLOCK_WILDCARD } from "../../blocks/const";
import { parseBlockId } from "../../blocks/namespace";
import { getDefaultBlockRegistry, isBlockAllowed } from "../../blocks/registry";
import { toBlockCatalogEntry } from "../block-picker/catalog";
import { BlockCatalogEntryCard } from "../block-picker/entry-card";
import { useVisualEditor } from "../context";
import { EditorDndContext } from "./context";
import {
  dropEdgeFor,
  dropPlacement,
  preferBlockCollisions,
  readDragSource,
  readDropTarget,
  resolveDrop,
  zoneIdFromDroppableId,
} from "./resolve-drop";

type DragOverlayPreview =
  | { entry: BlockCatalogEntry; kind: "catalog-block" }
  | { kind: "existing-block"; name: string; namespace: null | string };

interface EditorDragPlan {
  placement: DropPlacement | null;
  rejected: boolean;
  resolved: null | ResolvedDrop;
  source: EditorDragSource;
  zoneId: null | string;
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
    left.blockId === right.blockId &&
    left.edge === right.edge);

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

    return preferBlockCollisions(
      pointer.length > 0 ? pointer : rectIntersection(args),
    );
  }, []);

  const dnd = useMemo<EditorDndContextValue>(
    () => ({
      dragging,
      draggingType: dragging?.type ?? null,
      dropIndicator,
    }),
    [dragging, dropIndicator],
  );

  const overlay = useMemo<DragOverlayPreview | null>(() => {
    if (!dragging) return null;

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

    const entry = state.zones[dragging.zoneId]?.registry?.get(dragging.type);

    return {
      kind: "existing-block",
      name: entry?.definition.name ?? entry?.definition.id ?? dragging.type,
      namespace: parseBlockId(dragging.type)?.namespace ?? null,
    };
  }, [dragging, state.zones]);

  const blockName = useCallback(
    (source: EditorDragSource): string => {
      const found = findRegisteredBlock(state.zones, source.type);

      return found?.definition.name ?? found?.definition.id ?? source.type;
    },
    [state.zones],
  );

  const planDrop = useCallback(
    (active: Active, over: null | Over): EditorDragPlan | null => {
      const source = readDragSource(String(active.id), active.data.current);
      if (!source) return null;

      const outside: EditorDragPlan = {
        placement: null,
        rejected: false,
        resolved: null,
        source,
        zoneId: null,
      };
      if (!over) return outside;

      const edgeFor = (): EditorDropEdge | null => {
        const pointerY = pointerYRef.current;

        if (pointerY === null) return null;
        if (zoneIdFromDroppableId(String(over.id)) !== null) return null;

        return dropEdgeFor({ pointerY, rect: over.rect });
      };

      const target = readDropTarget(
        String(over.id),
        over.data.current,
        edgeFor(),
      );
      const zone = target === null ? undefined : state.zones[target.zoneId];
      if (!target || !zone) return outside;

      const resolved = resolveDrop({
        allowedBlocks: zone.allowedBlocks,
        source,
        target,
        targetBlockCount: zone.blocks.length,
      });

      return {
        placement:
          resolved === null
            ? null
            : dropPlacement({
                blockIds: zone.blocks.map(block => block.id),
                overBlockId: target.blockId,
                resolved,
              }),
        rejected: !isBlockAllowed(
          zone.allowedBlocks ?? BLOCK_WILDCARD,
          source.type,
        ),
        resolved,
        source,
        zoneId: target.zoneId,
      };
    },
    [state.zones],
  );

  const announcements = useMemo<Announcements>(() => {
    const landing = (active: Active, over: null | Over): string | undefined => {
      if (over !== null && String(over.id) === String(active.id))
        return undefined;

      const plan = planDrop(active, over);
      if (!plan) return undefined;

      const name = blockName(plan.source);
      if (plan.zoneId === null) return t("dnd.outside", { name });
      if (plan.rejected) return t("dnd.rejected", { name, zone: plan.zoneId });
      if (!plan.placement)
        return t("dnd.unchanged", { name, zone: plan.zoneId });

      return t("dnd.over", {
        name,
        position: plan.placement.position,
        total: plan.placement.total,
        zone: plan.zoneId,
      });
    };

    return {
      onDragCancel: ({ active }) => {
        const source = readDragSource(String(active.id), active.data.current);

        return t("dnd.cancelled", {
          name: source === null ? String(active.id) : blockName(source),
        });
      },
      onDragEnd: ({ active, over }) => {
        const plan = planDrop(active, over);
        if (!plan) return undefined;

        const name = blockName(plan.source);

        return plan.placement === null || plan.zoneId === null
          ? t("dnd.not_dropped", { name })
          : t("dnd.dropped", {
              name,
              position: plan.placement.position,
              total: plan.placement.total,
              zone: plan.zoneId,
            });
      },
      onDragOver: ({ active, over }) => landing(active, over),
      onDragStart: ({ active }) => {
        const source = readDragSource(String(active.id), active.data.current);

        return t("dnd.picked_up", {
          name: source === null ? String(active.id) : blockName(source),
        });
      },
    };
  }, [blockName, planDrop, t]);

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
    setDragging(readDragSource(String(active.id), active.data.current));
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
        index: resolved.toIndex,
        type: resolved.type,
        zoneId: resolved.toZoneId,
      });

      return;
    }

    dispatch({
      blockId: resolved.blockId,
      toIndex: resolved.toIndex,
      toZoneId: resolved.toZoneId,
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
                  <GripVerticalIcon
                    aria-hidden="true"
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm leading-relaxed font-medium">
                      {overlay.name}
                    </span>
                    {overlay.namespace === null ? null : (
                      <span className="text-muted-foreground truncate text-xs leading-relaxed">
                        {overlay.namespace}
                      </span>
                    )}
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
