import type { ReactElement, ReactNode } from "react";

import { cn } from "cn";
import {
  GripVerticalIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
  UngroupIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type { BlockAreaInstance } from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";
import type { ZoneDropState } from "./drop-state";

import {
  areaLayoutClassNames,
  areaLayoutStyle,
  areaLayoutWithDefaults,
  areaMarginStyle,
} from "../../blocks/area";
import { useVisualEditor } from "../context";
import { useEditorDnd } from "../dnd/context";
import { useAreaDroppable } from "../dnd/use-container-droppable";
import { useSortableNode } from "../dnd/use-sortable-node";
import {
  fitsZoneMax,
  refusesRemoval,
  refusesUnwrap,
  zoneCapacity,
} from "../state/bounds";
import { sameNodeRef } from "../state/reducer";
import { zoneDropState } from "./drop-state";
import { areaOpenSlots } from "./open-slots";
import { AREA_REJECTION_LABELS } from "./rejection-labels";

const DIALOG_EXIT_DELAY = 300;

const FRAME_CLASSES = {
  idle: "border-border/70",
  inserting: "border-primary/60 bg-primary/5",
  over: "border-primary bg-primary/5",
  rejected: "border-destructive/60 bg-destructive/5",
  targeting: "border-border",
} as const satisfies Record<ZoneDropState, string>;

export interface EditableAreaFrameProps {
  area: BlockAreaInstance;
  children: ReactNode;
  index: number;
  zoneId: string;
}

export const EditableAreaFrame = ({
  area,
  children,
  index,
  zoneId,
}: EditableAreaFrameProps): ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch, insertTarget, setInsertTarget, setPanel, state } =
    useVisualEditor();
  const { dropIndicator } = useEditorDnd();
  const [confirming, setConfirming] = useState(false);
  const nodeRef: EditorNodeRef = {
    areaId: null,
    kind: "area",
    nodeId: area.id,
    zoneId,
  };
  const { dragging, handleProps, setNodeRef, style } = useSortableNode({
    childTypes: area.children.map(child => child.type),
    index,
    nodeRef,
    type: undefined,
  });
  const {
    active,
    over,
    rejection,
    setNodeRef: setDropRef,
  } = useAreaDroppable({
    areaId: area.id,
    zoneId,
  });

  const capacity = zoneCapacity(state.zones[zoneId]);
  const full =
    capacity !== null && !fitsZoneMax(capacity.max, capacity.blocks + 1);
  const removeRefused = refusesRemoval(capacity, area.children.length);
  const ungroupRefused = refusesUnwrap(capacity, area.children.length);
  const layout = areaLayoutWithDefaults(area.layout);
  const selected = sameNodeRef(state.selected, nodeRef);
  const inserting =
    insertTarget?.zoneId === zoneId && insertTarget.areaId === area.id;
  const dropping = zoneDropState({
    active,
    inserting,
    over,
    rejected: rejection !== null,
  });
  const edge =
    dropIndicator?.nodeId === area.id &&
    dropIndicator.zoneId === zoneId &&
    dropIndicator.areaId === null
      ? dropIndicator.edge
      : null;
  const summary = t("area.summary", { columns: layout.columns });
  const openSlots = areaOpenSlots({
    children: area.children.length,
    columns: layout.columns,
    full,
  });

  const select = () => {
    dispatch({ ref: nodeRef, type: "select" });
  };

  const remove = () => {
    dispatch({ ref: nodeRef, type: "remove" });
  };

  const unwrap = () => {
    dispatch({ ref: nodeRef, type: "unwrap-area" });
  };

  const deleteLabel = t("area.remove");

  return (
    <div
      className={cn(
        "group/area relative my-2 rounded-lg border border-dashed p-3 transition-colors",
        FRAME_CLASSES[dropping],
        dragging ? "opacity-50" : "opacity-100",
        selected ? "ring-primary ring-2" : null,
      )}
      data-area-id={area.id}
      data-drop-edge={edge ?? undefined}
      data-selected={selected ? "" : undefined}
      ref={setNodeRef}
      style={{ ...style, ...areaMarginStyle(layout) }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          aria-current={selected}
          className={cn(
            "focus-visible:ring-ring rounded-md px-1.5 py-0.5 text-xs leading-relaxed transition-colors focus-visible:ring-2 focus-visible:outline-none",
            selected
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={select}
          type="button"
        >
          <span className="sr-only">{t("area.select")} </span>
          {summary}
        </button>

        <div
          className={cn(
            "flex items-center gap-1 transition-opacity",
            selected
              ? "opacity-100"
              : "opacity-0 group-focus-within/area:opacity-100 group-hover/area:opacity-100",
          )}
        >
          <TooltipWithContent text={t("move")}>
            <Button
              {...handleProps}
              aria-label={t("area.drag")}
              className="cursor-grab touch-none shadow-sm active:cursor-grabbing"
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <GripVerticalIcon />
            </Button>
          </TooltipWithContent>

          <TooltipWithContent text={t("area.settings")}>
            <Button
              aria-label={t("area.settings")}
              className="shadow-sm"
              onClick={() => {
                select();
              }}
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <Settings2Icon />
            </Button>
          </TooltipWithContent>

          <TooltipWithContent text={t("area.ungroup")}>
            <Button
              aria-label={t("area.ungroup")}
              className="shadow-sm"
              disabled={ungroupRefused}
              onClick={unwrap}
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <UngroupIcon />
            </Button>
          </TooltipWithContent>

          {area.children.length === 0 ? (
            <TooltipWithContent text={deleteLabel}>
              <Button
                aria-label={deleteLabel}
                className="shadow-sm"
                disabled={removeRefused}
                onClick={remove}
                size="icon-sm"
                type="button"
                variant="destructive"
              >
                <Trash2Icon />
              </Button>
            </TooltipWithContent>
          ) : (
            <ConfirmActionAlertDialog
              description={
                <span className="flex flex-col items-start gap-3">
                  <span className="text-pretty">
                    {t("area.delete.desc", { count: area.children.length })}
                  </span>

                  <Button
                    disabled={ungroupRefused}
                    onClick={() => {
                      setConfirming(false);
                      unwrap();
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <UngroupIcon />
                    {t("area.delete.ungroup")}
                  </Button>
                </span>
              }
              onOpenChange={setConfirming}
              onSubmit={({ onClose }) => {
                onClose();
                setTimeout(remove, DIALOG_EXIT_DELAY);
              }}
              open={confirming}
              submitVariant="destructive"
              textSubmit={t("area.delete.confirm")}
              title={t("area.delete.title")}
            >
              <Button
                aria-label={deleteLabel}
                className="shadow-sm"
                disabled={removeRefused}
                size="icon-sm"
                variant="destructive"
              >
                <Trash2Icon />
              </Button>
            </ConfirmActionAlertDialog>
          )}
        </div>
      </div>

      {rejection === null ? null : (
        <p className="text-destructive mt-2 text-xs leading-relaxed text-pretty">
          {t(AREA_REJECTION_LABELS[rejection])}
        </p>
      )}

      <div className="mt-2 flex flex-col gap-3">
        <div
          className={cn(areaLayoutClassNames(layout))}
          ref={setDropRef}
          style={areaLayoutStyle(layout)}
        >
          {children}

          {Array.from({ length: openSlots }, (_, slot) => (
            <div
              className="border-border/70 flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center"
              key={slot}
            >
              <PlusIcon
                aria-hidden="true"
                className="text-muted-foreground size-5"
              />
              <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
                {full ? t("zone.full") : t("area.drop_here")}
              </p>
            </div>
          ))}
        </div>

        {full ? null : (
          <Button
            className="self-center"
            onClick={() => {
              setInsertTarget({
                areaId: area.id,
                index: area.children.length,
                zoneId,
              });
              setPanel();
            }}
            size="sm"
            variant="outline"
          >
            <PlusIcon />
            {t("area.add_block")}
          </Button>
        )}
      </div>

      {edge === null ? null : (
        <span
          aria-hidden="true"
          className={cn(
            "bg-primary pointer-events-none absolute inset-x-0 z-20 h-0.5 rounded-full",
            edge === "before" ? "-top-1" : "-bottom-1",
          )}
        >
          <span className="bg-primary absolute start-0 top-1/2 size-2 -translate-y-1/2 rounded-full" />
        </span>
      )}
    </div>
  );
};
