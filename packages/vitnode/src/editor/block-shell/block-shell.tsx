import type { ReactElement, ReactNode } from "react";

import { cn } from "cn";
import {
  CopyIcon,
  GripVerticalIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";

import type { AnyBlockInstance } from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";
import type { EditableBlockIssue } from "./issue";

import { getDefaultBlockRegistry } from "../../blocks/registry";
import { useVisualEditor } from "../context";
import { useEditorDnd } from "../dnd/context";
import { useSortableNode } from "../dnd/use-sortable-node";
import { sameNodeRef } from "../state/reducer";
import { editableBlockIssue } from "./issue";

const ISSUE_LABELS = {
  "invalid-data": "block.issue.invalid_data",
  "not-allowed": "block.issue.not_allowed",
  "unknown-type": "block.issue.unknown_type",
  "unknown-variant": "block.issue.unknown_variant",
} as const satisfies Record<EditableBlockIssue["kind"], string>;

const actionClassName = cn(
  buttonVariants({ size: "icon-xs", variant: "secondary" }),
  "shadow-sm",
);

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
  const { dispatch, preview, state } = useVisualEditor();
  const { dropIndicator } = useEditorDnd();
  const nodeRef: EditorNodeRef = {
    areaId,
    kind: "block",
    nodeId: instance.id,
    zoneId,
  };
  const { dragging, handleProps, setNodeRef, style } = useSortableNode({
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
    entry,
    instance,
  });
  const placed =
    dropIndicator?.nodeId === instance.id &&
    dropIndicator.zoneId === zoneId &&
    dropIndicator.areaId === areaId
      ? dropIndicator
      : null;
  const edge = placed?.edge ?? null;

  return (
    <div
      className={cn(
        "group/block relative rounded-md transition-opacity",
        dragging ? "opacity-50" : "opacity-100",
        selected ? "ring-primary ring-2" : "hover:ring-border hover:ring-1",
      )}
      data-block-id={instance.id}
      data-block-type={instance.type}
      data-drop-edge={edge ?? undefined}
      data-selected={selected ? "" : undefined}
      ref={setNodeRef}
      style={style}
    >
      <div inert>{children}</div>

      <button
        aria-current={selected}
        className="focus-visible:ring-ring absolute inset-0 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => {
          dispatch({ ref: nodeRef, type: "select" });
        }}
        type="button"
      >
        <span className="sr-only">{t("block.select", { name })}</span>
      </button>

      <div
        className={cn(
          "absolute end-2 top-2 z-10 flex items-center gap-1 transition-opacity",
          selected
            ? "opacity-100"
            : "opacity-0 group-focus-within/block:opacity-100 group-hover/block:opacity-100",
        )}
      >
        <button
          {...handleProps}
          aria-label={t("block.drag", { name })}
          className={cn(
            actionClassName,
            "cursor-grab touch-none active:cursor-grabbing",
          )}
          type="button"
        >
          <GripVerticalIcon />
        </button>

        <button
          aria-label={t("block.duplicate", { name })}
          className={actionClassName}
          onClick={() => {
            dispatch({ ref: nodeRef, type: "duplicate" });
          }}
          type="button"
        >
          <CopyIcon />
        </button>

        <button
          aria-label={t("block.remove", { name })}
          className={cn(
            buttonVariants({ size: "icon-xs", variant: "destructive" }),
            "shadow-sm",
          )}
          onClick={() => {
            dispatch({ ref: nodeRef, type: "remove" });
          }}
          type="button"
        >
          <Trash2Icon />
        </button>
      </div>

      {issue === null ? null : (
        <p className="border-destructive/60 bg-background text-destructive pointer-events-none absolute start-2 top-2 z-10 flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs leading-relaxed">
          <TriangleAlertIcon aria-hidden="true" className="size-3" />
          {t(ISSUE_LABELS[issue.kind])}
        </p>
      )}

      {placed === null ? null : placed.axis === "horizontal" ? (
        <span
          aria-hidden="true"
          className={cn(
            "bg-primary pointer-events-none absolute inset-y-0 z-20 w-0.5 rounded-full",
            placed.edge === "before" ? "-start-1" : "-end-1",
          )}
        >
          <span className="bg-primary absolute start-1/2 top-0 size-2 -translate-x-1/2 rounded-full rtl:translate-x-1/2" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "bg-primary pointer-events-none absolute inset-x-0 z-20 h-0.5 rounded-full",
            placed.edge === "before" ? "-top-1" : "-bottom-1",
          )}
        >
          <span className="bg-primary absolute start-0 top-1/2 size-2 -translate-y-1/2 rounded-full" />
        </span>
      )}
    </div>
  );
};
