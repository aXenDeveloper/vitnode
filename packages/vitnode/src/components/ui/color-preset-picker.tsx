import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import {
  COLOR_PRESETS,
  type ColorPreset,
  getColorPresetId,
  getColorPresetValue,
  prefersDarkCheckMark,
} from "./color-presets";

const ColorPresetSwatch = ({ preset }: { preset: ColorPreset }) => {
  const t = useTranslations("core.global.color_presets");

  return (
    <RadioPrimitive.Root
      aria-label={t(preset.id)}
      className={cn(
        "border-border/60 focus-visible:ring-ring/50 data-checked:ring-ring data-checked:ring-offset-background ease-fluid flex aspect-square w-full cursor-pointer items-center justify-center rounded-md border transition-transform duration-150 outline-none focus-visible:ring-3 data-checked:ring-2 data-checked:ring-offset-1 motion-safe:hover:scale-110 motion-safe:active:scale-95",
        !preset.value && "bg-foreground text-background",
        preset.value &&
          (prefersDarkCheckMark(preset.value) ? "text-gray-950" : "text-white"),
      )}
      style={preset.value ? { backgroundColor: preset.value } : undefined}
      value={preset.id}
    >
      <RadioPrimitive.Indicator className="flex items-center justify-center">
        <CheckIcon aria-hidden className="size-3.5" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
};

export const ColorPresetPicker = ({
  value = "",
  onChange,
  className,
}: {
  className?: string;
  onChange?: (value: string) => void;
  value?: string;
}) => {
  const t = useTranslations("core.global.color_presets");

  return (
    <RadioGroupPrimitive
      aria-label={t("label")}
      className={cn(
        "grid w-56 grid-cols-6 gap-1.5 sm:w-50 sm:grid-cols-8 sm:gap-1",
        className,
      )}
      onValueChange={(next: unknown) => {
        if (typeof next === "string") onChange?.(getColorPresetValue(next));
      }}
      value={getColorPresetId(value)}
    >
      {COLOR_PRESETS.map(preset => (
        <ColorPresetSwatch key={preset.id} preset={preset} />
      ))}
    </RadioGroupPrimitive>
  );
};
