import type { ReactElement } from "react";

import { useTranslations } from "use-intl";

import type { AnyBlockDefinition } from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";

import { blockVariantLabel } from "../../blocks/variant";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useVisualEditor } from "../context";
import { LabelledControl } from "./labelled-control";
import {
  VARIANT_CLEAR_VALUE,
  variantControlSpec,
  variantFromControlValue,
} from "./selection";

export const BlockVariantControl = ({
  definition,
  target,
  variant,
}: {
  definition: AnyBlockDefinition;
  target: EditorNodeRef;
  variant: string | undefined;
}): null | ReactElement => {
  const t = useTranslations("core.editor");
  const tGlobal = useTranslations("core.global");
  const { dispatch } = useVisualEditor();
  const spec = variantControlSpec(definition, variant);

  if (!spec.visible) return null;

  const items = [
    ...(spec.clearable
      ? [{ label: t("variant.clear"), value: VARIANT_CLEAR_VALUE }]
      : []),
    ...spec.options.map(option => ({
      label: blockVariantLabel(option),
      value: option.id,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      {spec.unknown === null ? null : (
        <div
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3"
          role="status"
        >
          <p className="text-sm leading-relaxed text-pretty">
            {t("variant.unknown", { variant: spec.unknown })}
          </p>
        </div>
      )}

      <LabelledControl
        description={
          spec.clearable
            ? `${t("variant.hint")} ${t("variant.clear_hint")}`
            : t("variant.hint")
        }
        label={t("variant.label")}
      >
        {ids => (
          <Select
            items={items}
            onValueChange={value => {
              if (typeof value !== "string") return;

              dispatch({
                ref: target,
                type: "set-variant",
                variant: variantFromControlValue(value),
              });
            }}
            value={spec.value ?? null}
          >
            <SelectTrigger {...ids} className="w-full">
              <SelectValue placeholder={tGlobal("select_option")} />
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
    </div>
  );
};
