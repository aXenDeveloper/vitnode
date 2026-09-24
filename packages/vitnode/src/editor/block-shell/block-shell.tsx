import type { ReactElement, ReactNode } from "react";

import { cn } from "cn";
import { PencilIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type { AnyBlockInstance } from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";
import type { EditableBlockIssue } from "./issue";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import { useVisualEditor } from "../context";
import { useEditorDnd } from "../dnd/context";
import { useSortableNode } from "../dnd/use-sortable-node";
import { refusesRemoval, zoneCapacity } from "../state/bounds";
import { sameNodeRef } from "../state/reducer";
import { isRepairRemoval } from "../state/repair";
import {
  DropIndicator,
  NODE_ARRIVAL_CLASS,
  NODE_DESTRUCTIVE_ACTION_CLASS,
  NodeToolbar,
  NodeToolbarSeparator,
} from "../zones/node-chrome";
import { editableBlockIssue } from "./issue";

const ISSUE_LABELS = {
  "invalid-data": "block.issue.invalid_data",
  "not-allowed": "block.issue.not_allowed",
  "unknown-type": "block.issue.unknown_type",
  "unknown-variant": "block.issue.unknown_variant",
} as const satisfies Record<EditableBlockIssue["kind"], string>;

export interface EditableBlockShellProps {
  areaId: null | string;
  children: ReactNode;
  index: number;
  instance: AnyBlockInstance;
  zoneId: string;
}

export const EditableBlockShell = ({
  areaId,
  children,
  index,
  instance,
  zoneId,
}: EditableBlockShellProps): ReactElement => {
  const t = useTranslations("core.editor");
  const { arrivingNodeId, dispatch, preview, state } = useVisualEditor();
  const { dropIndicator } = useEditorDnd();
  const nodeRef: EditorNodeRef = {
    areaId,
    kind: "block",
    nodeId: instance.id,
    zoneId,
  };
  const { activatorProps, dragListeners, dragging, setNodeRef, style } =
    useSortableNode({
      index,
      nodeRef,
      type: instance.type,
    });

  if (preview) return <>{children}</>;

  const zone = state.zones[zoneId];
  const entry = (zone?.registry ?? getDefaultBlockRegistry())?.get(
    instance.type,
  );
  const name = entry?.definition.name ?? instance.type;
  const selected = sameNodeRef(state.selected, nodeRef);
  const issue = editableBlockIssue({
    allowedBlocks: zone?.allowedBlocks,
    dataCheck: "schema",
    entry,
    instance,
  });
  const capacity = zoneCapacity(zone);
  const removeRefused = refusesRemoval(
    capacity,
    1,
    zone !== undefined && isRepairRemoval(zone, instance),
  );
  const placed =
    dropIndicator?.nodeId === instance.id &&
    dropIndicator.zoneId === zoneId &&
    dropIndicator.areaId === areaId
      ? dropIndicator
      : null;
  const revealed = selected && !dragging;

  return (
    <div
      className={cn(
        "group/block relative rounded-md transition-[box-shadow,background-color,outline-color] duration-150 ease-out motion-reduce:transition-none",
        dragging
          ? "bg-primary/5 outline-primary/50 outline-2 -outline-offset-2 outline-dashed"
          : selected
            ? "ring-primary ring-2"
            : "hover:ring-primary/50 hover:ring-1",
        arrivingNodeId === instance.id && NODE_ARRIVAL_CLASS,
      )}
      data-block-id={instance.id}
      data-block-type={instance.type}
      data-drop-edge={placed?.edge}
      data-selected={selected ? "" : undefined}
      ref={setNodeRef}
      style={style}
    >
      <div
        className={cn(
          "transition-opacity duration-150 motion-reduce:transition-none",
          dragging && "opacity-30",
        )}
        inert
      >
        {children}
      </div>

      <button
        {...activatorProps}
        {...dragListeners}
        aria-current={selected}
        className="focus-visible:ring-ring absolute inset-0 cursor-grab rounded-md focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
        onClick={() => {
          dispatch({ ref: nodeRef, type: "select" });
        }}
        type="button"
      >
        <span className="sr-only">{t("block.select", { name })}</span>
      </button>

      <NodeToolbar
        className={cn(
          "absolute end-2 top-2 z-30",
          revealed
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1 opacity-0 group-focus-within/block:pointer-events-auto group-focus-within/block:translate-y-0 group-focus-within/block:opacity-100 group-hover/block:pointer-events-auto group-hover/block:translate-y-0 group-hover/block:opacity-100",
        )}
      >
        <TooltipWithContent text={t("edit")}>
          <Button
            aria-label={t("block.edit", { name })}
            onClick={() => {
              dispatch({ ref: nodeRef, type: "select" });
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <PencilIcon />
          </Button>
        </TooltipWithContent>

        <NodeToolbarSeparator />

        <TooltipWithContent text={t("remove")}>
          <Button
            aria-label={t("block.remove", { name })}
            className={NODE_DESTRUCTIVE_ACTION_CLASS}
            disabled={removeRefused}
            onClick={() => {
              dispatch({ ref: nodeRef, type: "remove" });
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </TooltipWithContent>
      </NodeToolbar>

      {issue === null ? null : (
        <p className="border-destructive/40 bg-card text-destructive pointer-events-none absolute start-2 top-2 z-10 flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs leading-relaxed shadow-xs">
          <TriangleAlertIcon aria-hidden="true" className="size-3" />
          {t(ISSUE_LABELS[issue.kind])}
        </p>
      )}

      {placed === null ? null : (
        <DropIndicator
          axis={placed.axis}
          edge={placed.edge}
          key={placed.edge}
        />
      )}
    </div>
  );
};
