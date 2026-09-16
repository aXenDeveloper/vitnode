import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
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
import { GripVerticalIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { EditorDragSource } from "./resolve-drop";

import { parseBlockId } from "../../blocks/namespace";
import { useVisualEditor } from "../context";
import { EditorDndContext } from "./context";
import {
  preferBlockCollisions,
  readDragSource,
  readDropTarget,
  resolveDrop,
} from "./resolve-drop";

const collisionDetection: CollisionDetection = args => {
  const pointer = pointerWithin(args);

  return preferBlockCollisions(
    pointer.length > 0 ? pointer : rectIntersection(args),
  );
};

export const EditorDndProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => {
  const { dispatch, state } = useVisualEditor();
  const [dragging, setDragging] = useState<EditorDragSource | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const dnd = useMemo(
    () => ({
      draggingBlockId: dragging?.blockId ?? null,
      draggingType: dragging?.type ?? null,
    }),
    [dragging],
  );

  const preview = useMemo(() => {
    if (!dragging) return null;

    const entry = state.zones[dragging.zoneId]?.registry?.get(dragging.type);

    return {
      name: entry?.definition.name ?? entry?.definition.id ?? dragging.type,
      namespace: parseBlockId(dragging.type)?.namespace ?? null,
    };
  }, [dragging, state.zones]);

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragging(readDragSource(String(active.id), active.data.current));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;

    const source = readDragSource(String(active.id), active.data.current);
    if (!source) return;

    const target = readDropTarget(String(over.id), over.data.current);
    if (!target) return;

    const zone = state.zones[target.zoneId];
    if (!zone) return;

    const resolved = resolveDrop({
      allowedBlocks: zone.allowedBlocks,
      source,
      target,
      targetBlockCount: zone.blocks.length,
    });
    if (!resolved) return;

    dispatch({ ...resolved, type: "move" });
  };

  return (
    <EditorDndContext.Provider value={dnd}>
      <DndContext
        collisionDetection={collisionDetection}
        id="vitnode-visual-editor"
        modifiers={[restrictToWindowEdges]}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        sensors={sensors}
      >
        {children}

        <DragOverlay>
          {preview ? (
            <div className="bg-popover text-popover-foreground ring-primary flex cursor-grabbing items-center gap-2 rounded-lg border p-3 shadow-lg ring-2">
              <GripVerticalIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm leading-relaxed font-medium">
                  {preview.name}
                </span>
                {preview.namespace === null ? null : (
                  <span className="text-muted-foreground truncate text-xs leading-relaxed">
                    {preview.namespace}
                  </span>
                )}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </EditorDndContext.Provider>
  );
};
