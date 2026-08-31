"use client";

import { XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Input } from "./input";
import { Loader } from "./loader";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// react-colorful only ships in the bundle once the picker is actually opened.
const HslStringColorPicker = React.lazy(async () => ({
  default: (await import("react-colorful")).HslStringColorPicker,
}));

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
        <React.Suspense
          fallback={
            <div className="flex size-50 items-center justify-center">
              <Loader />
            </div>
          }
        >
          <HslStringColorPicker color={value} onChange={onChange} />
        </React.Suspense>

        <Input
          className="w-50"
          onChange={event => onChange?.(event.target.value)}
          placeholder={placeholder ?? "hsl(240, 80%, 60%)"}
          value={value}
        />

        {allowRemoveColor && value && (
          <Button
            className="w-50"
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
