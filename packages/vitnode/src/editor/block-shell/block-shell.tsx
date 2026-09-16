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
import type { EditableBlockIssue } from "./issue";

import { useVisualEditor } from "../context";
import { useSortableBlock } from "../dnd/use-sortable-block";
import { editableBlockIssue } from "./issue";

const ISSUE_LABELS = {
  "invalid-data": "block.issue.invalid_data",
  "not-allowed": "block.issue.not_allowed",
  "unknown-type": "block.issue.unknown_type",
} as const satisfies Record<EditableBlockIssue, string>;

const actionClassName = cn(
  buttonVariants({ size: "icon-xs", variant: "secondary" }),
  "shadow-sm",
);

export interface EditableBlockShellProps {
  children: ReactNode;
  index: number;
  instance: AnyBlockInstance;
  zoneId: string;
}

export const EditableBlockShell = ({
  children,
  index,
  instance,
  zoneId,
}: EditableBlockShellProps): ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch, preview, state } = useVisualEditor();
  const { dragging, handleProps, setNodeRef, style } = useSortableBlock({
    blockId: instance.id,
    index,
    zoneId,
  });

  if (preview) return <>{children}</>;

  const zone = state.zones[zoneId];
  const entry = zone?.registry?.get(instance.type);
  const name = entry?.definition.name ?? instance.type;
  const selected = state.selectedBlockId === instance.id;
  const issue = editableBlockIssue({
    allowedBlocks: zone?.allowedBlocks,
    entry,
    instance,
  });

  return (
    <div
      className={cn(
        "group/block relative rounded-md transition-opacity",
        dragging ? "opacity-50" : "opacity-100",
        selected ? "ring-primary ring-2" : "hover:ring-border hover:ring-1",
      )}
      data-block-id={instance.id}
      data-block-type={instance.type}
      data-selected={selected ? "" : undefined}
      ref={setNodeRef}
      style={style}
    >
      <div inert>{children}</div>

      <button
        aria-current={selected}
        className="focus-visible:ring-ring absolute inset-0 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => {
          dispatch({ blockId: instance.id, type: "select" });
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
            dispatch({ blockId: instance.id, type: "duplicate" });
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
            dispatch({ blockId: instance.id, type: "remove" });
          }}
          type="button"
        >
          <Trash2Icon />
        </button>
      </div>

      {issue === null ? null : (
        <p className="border-destructive/60 bg-background text-destructive pointer-events-none absolute start-2 top-2 z-10 flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs leading-relaxed">
          <TriangleAlertIcon aria-hidden="true" className="size-3" />
          {t(ISSUE_LABELS[issue])}
        </p>
      )}
    </div>
  );
};
