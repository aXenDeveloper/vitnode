import { cn } from "cn";
import { XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { colorToHslString } from "@/lib/colors";

import { Button } from "./button";
import { ColorPresetPicker } from "./color-preset-picker";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Spinner } from "./spinner";

// react-colorful only ships in the bundle once the picker is actually opened.
const HslStringColorPicker = React.lazy(async () => ({
  default: (await import("react-colorful")).HslStringColorPicker,
}));

const FALLBACK_PICKER_COLOR = "hsl(0, 0%, 0%)";

export const ColorPicker = ({
  value = "",
  onChange,
  placeholder,
  allowRemoveColor,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children" | "onChange" | "value"> & {
  allowRemoveColor?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  value?: string;
}) => {
  const t = useTranslations("core.global");

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            className={cn("w-full justify-start font-normal", className)}
            variant="outline"
            {...props}
          />
        }
      >
        <span
          className="border-input size-4 shrink-0 rounded-sm border"
          style={value ? { backgroundColor: value } : undefined}
        />
        <span className={cn(!value && "text-muted-foreground")}>
          {value || (placeholder ?? t("pick_color"))}
        </span>
      </PopoverTrigger>

      <PopoverContent className="w-auto gap-3">
        <ColorPresetPicker onChange={onChange} value={value} />

        <React.Suspense
          fallback={
            <div className="flex size-50 items-center justify-center">
              <div className="flex items-center justify-center">
                <Spinner size="xl" />
              </div>
            </div>
          }
        >
          <HslStringColorPicker
            color={colorToHslString(value) ?? FALLBACK_PICKER_COLOR}
            onChange={onChange}
          />
        </React.Suspense>

        <Input
          className="w-full"
          onChange={event => onChange?.(event.target.value)}
          placeholder={placeholder ?? "hsl(215, 81%, 52%)"}
          value={value}
        />

        {allowRemoveColor && value && (
          <Button
            className="w-full"
            onClick={() => onChange?.("")}
            size="sm"
            type="button"
            variant="ghost"
          >
            <XIcon />
            {t("remove")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};
