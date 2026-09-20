import { cn } from "cn";
import { XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { EmojiIconValue } from "@/lib/emoji-icon";

import { humanizeIconName } from "@/lib/emoji-icon";

import { Button } from "./button";
import { EmojiIcon } from "./emoji-icon";
import { Loader } from "./loader";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const EmojiIconPickerPanel = React.lazy(async () =>
  import("./emoji-icon-picker-panel").then(module => ({
    default: module.EmojiIconPickerPanel,
  })),
);

/** Both kinds, unless a caller narrows it - see the `allow` prop. */
export const EMOJI_ICON_PICKER_KINDS = ["emoji", "icon"] as const;

export type EmojiIconPickerKind = (typeof EMOJI_ICON_PICKER_KINDS)[number];

export const EmojiIconPicker = ({
  allow = EMOJI_ICON_PICKER_KINDS,
  allowRemove,
  className,
  onChange,
  placeholder,
  value,
  ...props
}: Omit<React.ComponentProps<"button">, "children" | "onChange" | "value"> & {
  /** Which tabs the panel offers. One kind renders that picker on its own. */
  allow?: readonly EmojiIconPickerKind[];
  allowRemove?: boolean;
  onChange: (value: EmojiIconValue | undefined) => void;
  placeholder?: string;
  value?: EmojiIconValue;
}) => {
  const t = useTranslations("core.global.emoji_icon_picker");
  const [open, setOpen] = React.useState(false);

  const canRemove = Boolean(allowRemove) && !!value;

  return (
    <div className={cn("relative flex w-full items-center", className)}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <Button
              className={cn(
                "w-full justify-start font-normal",
                canRemove && "pe-10",
              )}
              variant="outline"
              {...props}
            />
          }
        >
          {value ? (
            <EmojiIcon className="size-4.5 text-base" value={value} />
          ) : (
            <span
              aria-hidden
              className="border-input size-4.5 shrink-0 rounded-sm border border-dashed"
            />
          )}

          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value?.type === "icon" && humanizeIconName(value.value)}
            {!value && (placeholder ?? t("placeholder"))}
          </span>
        </PopoverTrigger>

        <PopoverContent className="w-76 gap-0 p-0">
          <React.Suspense
            fallback={
              <div className="flex h-108 items-center justify-center">
                <Loader />
              </div>
            }
          >
            <EmojiIconPickerPanel
              allow={allow}
              onChange={next => {
                onChange(next);

                if (next) setOpen(false);
              }}
              value={value}
            />
          </React.Suspense>
        </PopoverContent>
      </Popover>

      {canRemove ? (
        <Button
          aria-label={t("remove")}
          className="text-muted-foreground absolute end-1 size-7"
          onClick={() => onChange(undefined)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
};
