import type { ReactElement, ReactNode } from "react";

import { cn } from "cn";
import {
  BanIcon,
  Columns2Icon,
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
import type { ZoneDropTone } from "./drop-state";

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
import { zoneDropState, zoneDropTone } from "./drop-state";
import {
  DROP_TARGET_CLASSES,
  DropIndicator,
  NODE_ARRIVAL_CLASS,
  NODE_DESTRUCTIVE_ACTION_CLASS,
  NodeToolbar,
  NodeToolbarSeparator,
} from "./node-chrome";
import { areaOpenSlots } from "./open-slots";
import { AREA_REJECTION_LABELS } from "./rejection-labels";

const DIALOG_EXIT_DELAY = 300;

const FRAME_CLASSES = {
  blocked: "border-border opacity-50",
  idle: "border-border hover:border-primary/40",
  inserting: "border-primary/60 bg-primary/3",
  over: "border-primary bg-primary/5",
  rejected: "border-destructive/60 bg-destructive/5",
  targeting: "border-primary/40",
} as const satisfies Record<ZoneDropTone, string>;

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
  const {
    arrivingNodeId,
    dispatch,
    insertTarget,
    setInsertTarget,
    setPanel,
    state,
  } = useVisualEditor();
  const { dropIndicator } = useEditorDnd();
  const [confirming, setConfirming] = useState(false);
  const nodeRef: EditorNodeRef = {
    areaId: null,
    kind: "area",
    nodeId: area.id,
    zoneId,
  };
  const { activatorProps, dragListeners, dragging, setNodeRef, style } =
    useSortableNode({
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
  const tone = zoneDropTone(
    zoneDropState({
      active,
      inserting,
      over,
      rejected: rejection !== null,
    }),
    over,
  );
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
        "group/area bg-card/40 relative my-2 flex cursor-grab flex-col gap-2 rounded-lg border p-3 transition-[border-color,background-color,box-shadow,opacity] duration-150 ease-out active:cursor-grabbing motion-reduce:transition-none",
        dragging
          ? "border-primary/50 bg-primary/5 border-dashed"
          : cn(
              FRAME_CLASSES[tone],
              selected && "border-primary ring-primary ring-1",
            ),
        arrivingNodeId === area.id && NODE_ARRIVAL_CLASS,
      )}
      data-area-id={area.id}
      data-drop-edge={edge ?? undefined}
      data-selected={selected ? "" : undefined}
      ref={setNodeRef}
      style={{ ...style, ...areaMarginStyle(layout) }}
      {...dragListeners}
    >
      <div
        className={cn(
          "flex min-h-8 flex-wrap items-center justify-between gap-2 transition-opacity duration-150",
          dragging && "opacity-30",
        )}
      >
        <button
          {...activatorProps}
          aria-current={selected}
          className={cn(
            "focus-visible:ring-ring flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs leading-relaxed font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing",
            selected
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={select}
          type="button"
        >
          <Columns2Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">{t("area.select")} </span>
          {summary}
        </button>

        <div
          className="contents"
          onKeyDown={event => event.stopPropagation()}
          onPointerDown={event => event.stopPropagation()}
        >
          <NodeToolbar
            className={
              selected && !dragging
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-1 opacity-0 group-focus-within/area:pointer-events-auto group-focus-within/area:translate-y-0 group-focus-within/area:opacity-100 group-hover/area:pointer-events-auto group-hover/area:translate-y-0 group-hover/area:opacity-100"
            }
          >
            <TooltipWithContent text={t("area.settings")}>
              <Button
                aria-label={t("area.settings")}
                onClick={() => {
                  select();
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Settings2Icon />
              </Button>
            </TooltipWithContent>

            <TooltipWithContent text={t("area.ungroup")}>
              <Button
                aria-label={t("area.ungroup")}
                disabled={ungroupRefused}
                onClick={unwrap}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <UngroupIcon />
              </Button>
            </TooltipWithContent>

            <NodeToolbarSeparator />

            {area.children.length === 0 ? (
              <TooltipWithContent text={deleteLabel}>
                <Button
                  aria-label={deleteLabel}
                  className={NODE_DESTRUCTIVE_ACTION_CLASS}
                  disabled={removeRefused}
                  onClick={remove}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
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
                  className={NODE_DESTRUCTIVE_ACTION_CLASS}
                  disabled={removeRefused}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </ConfirmActionAlertDialog>
            )}
          </NodeToolbar>
        </div>
      </div>

      {tone === "rejected" && rejection !== null ? (
        <p className="text-destructive flex items-center gap-1.5 text-xs leading-relaxed text-pretty">
          <BanIcon aria-hidden="true" className="size-3.5 shrink-0" />
          {t(AREA_REJECTION_LABELS[rejection])}
        </p>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-3 transition-opacity duration-150",
          dragging && "opacity-30",
        )}
      >
        <div
          className={cn(areaLayoutClassNames(layout))}
          ref={setDropRef}
          style={areaLayoutStyle(layout)}
        >
          {children}

          {Array.from({ length: openSlots }, (_, slot) => (
            <div
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center transition-colors duration-150",
                DROP_TARGET_CLASSES[tone],
              )}
              key={slot}
            >
              <PlusIcon aria-hidden="true" className="size-5" />
              <p className="text-xs leading-relaxed text-pretty">
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
            variant="ghost"
          >
            <PlusIcon />
            {t("area.add_block")}
          </Button>
        )}
      </div>

      {edge === null ? null : (
        <DropIndicator axis="vertical" edge={edge} key={edge} />
      )}
    </div>
  );
};
