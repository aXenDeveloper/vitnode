import type { ReactElement, ReactNode } from "react";

import { Columns2Icon, CopyIcon, Trash2Icon, UngroupIcon } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";

import type { BlockAreaInstance, BlockAreaLayout } from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";

import {
  areaLayoutWithDefaults,
  isAreaAlign,
  isAreaColumns,
  isAreaJustify,
} from "../../blocks/area";
import { ConfirmActionAlertDialog } from "../../components/confirm-action/confirm-action-alert-dialog";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Slider } from "../../components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { TooltipWithContent } from "../../components/ui/tooltip";
import { useVisualEditor } from "../context";
import {
  EditorPanelBack,
  EditorPanelHeader,
  EditorPanelSeparator,
} from "../sidebar/panel-header";
import {
  refusesDuplicate,
  refusesRemoval,
  refusesUnwrap,
  zoneCapacity,
} from "../state/bounds";
import {
  AREA_LAYOUT_OPTIONS,
  AREA_SPACING_RANGE,
  areaDeleteMode,
  clampAreaSpacing,
  nextAreaLayout,
} from "./area-layout";
import { afterDialogExit } from "./dialog-exit";
import { LabelledControl } from "./labelled-control";

interface TokenOption {
  label: string;
  value: string;
}

const AreaPanelGroup = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}): ReactElement => (
  <section className="flex flex-col gap-4">
    <h3 className="text-muted-foreground text-xs leading-relaxed font-medium tracking-wider uppercase">
      {title}
    </h3>

    {children}
  </section>
);

const AreaColumnsControl = ({
  label,
  onSelect,
  value,
}: {
  label: string;
  onSelect: (value: BlockAreaLayout["columns"]) => void;
  value: BlockAreaLayout["columns"];
}): ReactElement => {
  const t = useTranslations("core.editor");

  return (
    <LabelledControl label={label}>
      {ids => (
        <ToggleGroup
          {...ids}
          className="bg-muted w-full rounded-lg p-0.5"
          onValueChange={next => {
            const picked = Number(next[0]);

            if (isAreaColumns(picked)) onSelect(picked);
          }}
          spacing={0.5}
          value={[String(value)]}
        >
          {AREA_LAYOUT_OPTIONS.columns.map(option => (
            <ToggleGroupItem
              aria-label={t("area.columns_value", { columns: option })}
              className="text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground flex-1 tabular-nums transition-[background-color,color,box-shadow] duration-150 hover:bg-transparent aria-pressed:shadow-sm"
              key={option}
              size="sm"
              value={String(option)}
            >
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </LabelledControl>
  );
};

const AreaLayoutSelect = ({
  items,
  label,
  onSelect,
  value,
}: {
  items: readonly TokenOption[];
  label: string;
  onSelect: (value: string) => void;
  value: string;
}): ReactElement => (
  <LabelledControl label={label}>
    {ids => (
      <Select
        items={[...items]}
        onValueChange={next => {
          if (typeof next !== "string") return;

          onSelect(next);
        }}
        value={value}
      >
        <SelectTrigger {...ids} className="w-full">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}
  </LabelledControl>
);

/**
 * A spacing in pixels, dragged rather than typed.
 *
 * The page re-lays out under the thumb as it moves, which is the whole point of
 * a slider here: the number beside it is the answer, but the layout is the
 * thing being chosen.
 */
const AreaSpacingSlider = ({
  label,
  onSelect,
  value,
}: {
  label: string;
  onSelect: (value: number) => void;
  value: number;
}): ReactElement => {
  const t = useTranslations("core.editor");

  return (
    <LabelledControl label={label} value={t("area.spacing_px", { px: value })}>
      {ids => (
        <Slider
          {...ids}
          className="py-1"
          max={AREA_SPACING_RANGE.max}
          min={AREA_SPACING_RANGE.min}
          onValueChange={next => {
            const picked = Array.isArray(next) ? next[0] : next;

            if (typeof picked === "number") {
              onSelect(clampAreaSpacing(picked));
            }
          }}
          step={1}
          value={[value]}
        />
      )}
    </LabelledControl>
  );
};

export const AreaPropertiesPanelContent = ({
  area,
  target,
}: {
  area: BlockAreaInstance;
  target: EditorNodeRef;
}): ReactElement => {
  const { dispatch, setPanel, state } = useVisualEditor();
  const t = useTranslations("core.editor");
  const [confirming, setConfirming] = useState(false);

  const capacity = zoneCapacity(state.zones[target.zoneId]);
  const duplicateRefused = refusesDuplicate(
    capacity,
    area.children.length,
    null,
  );
  const removeRefused = refusesRemoval(capacity, area.children.length);
  const ungroupRefused = refusesUnwrap(capacity, area.children.length);

  const layout = areaLayoutWithDefaults(area.layout);
  const columns = layout.columns;
  const apply = (patch: Partial<BlockAreaLayout>): void => {
    dispatch({
      layout: nextAreaLayout(layout, patch),
      ref: target,
      type: "update-area-layout",
    });
  };

  const ungroup = (): void => {
    dispatch({ ref: target, type: "unwrap-area" });
    setPanel();
  };

  return (
    <section aria-label={t("area.properties")} className="flex flex-col">
      <EditorPanelHeader
        actions={
          <>
            <TooltipWithContent text={t("area.duplicate")}>
              <Button
                aria-label={t("area.duplicate")}
                disabled={duplicateRefused}
                onClick={() => {
                  dispatch({ ref: target, type: "duplicate" });
                }}
                size="icon-sm"
                variant="ghost"
              >
                <CopyIcon />
              </Button>
            </TooltipWithContent>

            <TooltipWithContent text={t("area.ungroup")}>
              <Button
                aria-label={t("area.ungroup")}
                disabled={ungroupRefused}
                onClick={ungroup}
                size="icon-sm"
                variant="ghost"
              >
                <UngroupIcon />
              </Button>
            </TooltipWithContent>

            <EditorPanelSeparator />

            <TooltipWithContent text={t("area.remove")}>
              <Button
                aria-label={t("area.remove")}
                className="hover:bg-destructive/10 hover:text-destructive -me-2"
                disabled={removeRefused}
                onClick={() => {
                  setConfirming(true);
                }}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2Icon />
              </Button>
            </TooltipWithContent>
          </>
        }
        description={t("area.columns_value", { columns })}
        icon={<Columns2Icon />}
        leading={<EditorPanelBack />}
        title={t("area.name")}
      />

      <div className="flex flex-col gap-8 p-4">
        <AreaPanelGroup title={t("area.section_layout")}>
          <AreaColumnsControl
            label={t("area.columns")}
            onSelect={picked => {
              apply({ columns: picked });
            }}
            value={columns}
          />

          <AreaLayoutSelect
            items={AREA_LAYOUT_OPTIONS.align.map(option => ({
              label: t(`area.align_option.${option}`),
              value: option,
            }))}
            label={t("area.align")}
            onSelect={value => {
              if (isAreaAlign(value)) apply({ align: value });
            }}
            value={layout.align}
          />

          <AreaLayoutSelect
            items={AREA_LAYOUT_OPTIONS.justify.map(option => ({
              label: t(`area.justify_option.${option}`),
              value: option,
            }))}
            label={t("area.justify")}
            onSelect={value => {
              if (isAreaJustify(value)) apply({ justify: value });
            }}
            value={layout.justify}
          />
        </AreaPanelGroup>

        <AreaPanelGroup title={t("area.section_spacing")}>
          <AreaSpacingSlider
            label={t("area.gap")}
            onSelect={gap => {
              apply({ gap });
            }}
            value={layout.gap}
          />

          <AreaSpacingSlider
            label={t("area.margin_y")}
            onSelect={marginY => {
              apply({ marginY });
            }}
            value={layout.marginY}
          />

          <AreaSpacingSlider
            label={t("area.margin_x")}
            onSelect={marginX => {
              apply({ marginX });
            }}
            value={layout.marginX}
          />
        </AreaPanelGroup>
      </div>

      <ConfirmActionAlertDialog
        description={
          areaDeleteMode(area) === "empty" ? (
            t("area.delete.empty")
          ) : (
            <>
              {t("area.delete.desc", { count: area.children.length })}{" "}
              <Button
                className="mt-3 w-full"
                disabled={ungroupRefused}
                onClick={() => {
                  setConfirming(false);
                  ungroup();
                }}
                size="sm"
                variant="outline"
              >
                <UngroupIcon />
                {t("area.delete.ungroup")}
              </Button>
            </>
          )
        }
        onOpenChange={setConfirming}
        onSubmit={({ onClose }) => {
          afterDialogExit(onClose, () => {
            dispatch({ ref: target, type: "remove" });
            setPanel();
          });
        }}
        open={confirming}
        submitVariant="destructive"
        textSubmit={t("area.delete.confirm")}
        title={t("area.delete.title")}
      />
    </section>
  );
};
