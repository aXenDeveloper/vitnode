import type { FocusEvent, ReactElement, ReactNode } from "react";

import { cn } from "cn";
import {
  GripVerticalIcon,
  PencilIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useLayoutEffect, useRef } from "react";
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
import { useEditorInlineBlock } from "../inline/context";
import { refusesRemoval, zoneCapacity } from "../state/bounds";
import { sameNodeRef } from "../state/reducer";
import { isRepairRemoval } from "../state/repair";
import { editableBlockIssue } from "./issue";

const ISSUE_LABELS = {
  "invalid-data": "block.issue.invalid_data",
  "not-allowed": "block.issue.not_allowed",
  "unknown-type": "block.issue.unknown_type",
  "unknown-variant": "block.issue.unknown_variant",
} as const satisfies Record<EditableBlockIssue["kind"], string>;

const FOCUSABLE =
  'a[href], area[href], button, details, iframe, input, select, textarea, [contenteditable], [tabindex]:not([tabindex="-1"])';

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
  const inline = useEditorInlineBlock();
  const overlayRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
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
  const softInert = !preview && inline?.hasInlineFields === true;

  useLayoutEffect(() => {
    const body = bodyRef.current;

    if (!softInert || body === null) return;

    const held = [...body.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter(node => node.closest("[data-vitnode-inline-field]") === null)
      .map(node => [node, node.getAttribute("tabindex")] as const);

    for (const [node] of held) node.setAttribute("tabindex", "-1");

    return () => {
      for (const [node, previous] of held) {
        if (previous === null) node.removeAttribute("tabindex");
        else node.setAttribute("tabindex", previous);
      }
    };
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
  const edge = placed?.edge ?? null;

  const keepFocusOut = (event: FocusEvent<HTMLDivElement>): void => {
    const focused = event.target;

    if (focused.closest("[data-vitnode-inline-field]") !== null) return;

    const overlay = overlayRef.current;

    if (overlay === null) {
      focused.blur();

      return;
    }

    overlay.focus();
  };

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
      {softInert ? (
        <div
          className="pointer-events-none"
          onFocusCapture={keepFocusOut}
          ref={bodyRef}
        >
          {children}
        </div>
      ) : (
        <div inert>{children}</div>
      )}

      <button
        aria-current={selected}
        className="focus-visible:ring-ring absolute inset-0 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => {
          dispatch({ ref: nodeRef, type: "select" });
        }}
        ref={overlayRef}
        type="button"
      >
        <span className="sr-only">{t("block.select", { name })}</span>
      </button>

      <div
        className={cn(
          "absolute end-2 top-2 z-30 flex items-center gap-1 transition-opacity",
          selected
            ? "opacity-100"
            : "opacity-0 group-focus-within/block:opacity-100 group-hover/block:opacity-100",
        )}
      >
        <TooltipWithContent text={t("move")}>
          <Button
            {...handleProps}
            aria-label={t("block.drag", { name })}
            className="cursor-grab touch-none shadow-sm active:cursor-grabbing"
            size="icon-sm"
            type="button"
            variant="secondary"
          >
            <GripVerticalIcon />
          </Button>
        </TooltipWithContent>

        <TooltipWithContent text={t("edit")}>
          <Button
            aria-label={t("block.edit", { name })}
            className="shadow-sm"
            onClick={() => {
              dispatch({ ref: nodeRef, type: "select" });
            }}
            size="icon-sm"
            type="button"
            variant="secondary"
          >
            <PencilIcon />
          </Button>
        </TooltipWithContent>

        <TooltipWithContent text={t("remove")}>
          <Button
            aria-label={t("block.remove", { name })}
            className="shadow-sm"
            disabled={removeRefused}
            onClick={() => {
              dispatch({ ref: nodeRef, type: "remove" });
            }}
            size="icon-sm"
            type="button"
            variant="destructive"
          >
            <Trash2Icon />
          </Button>
        </TooltipWithContent>
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
