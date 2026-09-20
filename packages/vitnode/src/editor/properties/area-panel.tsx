import type { ReactElement } from "react";

import { CopyIcon, Trash2Icon, UngroupIcon } from "lucide-react";
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
import { useVisualEditor } from "../context";
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
    <LabelledControl label={label}>
      {ids => (
        <div className="flex flex-col gap-2">
          <Slider
            {...ids}
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

          <span className="text-muted-foreground text-xs leading-relaxed">
            {t("area.spacing_px", { px: value })}
          </span>
        </div>
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
    <section
      aria-label={t("area.properties")}
      className="flex flex-col gap-4 p-4"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-sm leading-none font-semibold text-balance">
          {t("area.properties")}
        </h2>
        <p className="text-muted-foreground truncate text-xs">
          {t("area.summary", { columns })}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <AreaLayoutSelect
          items={AREA_LAYOUT_OPTIONS.columns.map(option => ({
            label: t("area.columns_value", { columns: option }),
            value: String(option),
          }))}
          label={t("area.columns")}
          onSelect={value => {
            const picked = Number(value);
            if (!isAreaColumns(picked)) return;

            apply({ columns: picked });
          }}
          value={String(columns)}
        />

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
      </div>

      <div className="border-border flex flex-col gap-2 border-t pt-4">
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={duplicateRefused}
            onClick={() => {
              dispatch({ ref: target, type: "duplicate" });
            }}
            size="sm"
            variant="secondary"
          >
            <CopyIcon />
            {t("area.duplicate")}
          </Button>

          <Button
            className="flex-1"
            disabled={ungroupRefused}
            onClick={ungroup}
            size="sm"
            variant="secondary"
          >
            <UngroupIcon />
            {t("area.ungroup")}
          </Button>
        </div>

        <Button
          disabled={removeRefused}
          onClick={() => {
            setConfirming(true);
          }}
          size="sm"
          variant="destructive"
        >
          <Trash2Icon />
          {t("area.remove")}
        </Button>
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
