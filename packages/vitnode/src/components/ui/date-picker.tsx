import { cn } from "cn";
import { CalendarIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "./button";
import { Calendar, type CalendarProps } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type DatePickerProps = Omit<
  React.ComponentProps<"button">,
  "children" | "defaultValue" | "onChange" | "value"
> & {
  allowClear?: boolean;
  calendarProps?: Omit<
    Extract<CalendarProps, { mode: "single" }>,
    "mode" | "onSelect" | "selected"
  >;
  dateFormat?: Intl.DateTimeFormatOptions;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  value?: Date;
};

const DatePicker = ({
  value,
  onChange,
  placeholder,
  allowClear,
  calendarProps,
  dateFormat = DEFAULT_DATE_FORMAT,
  className,
  onBlur,
  ...props
}: DatePickerProps) => {
  const t = useTranslations("core.global");
  const locale = useLocale();
  const dateFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale, dateFormat),
    [dateFormat, locale],
  );
  const [open, setOpen] = React.useState(false);

  const select = (date: Date | undefined) => {
    onChange?.(date);
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className={cn("w-full justify-start font-normal", className)}
            onBlur={event => {
              if (!open) onBlur?.(event);
            }}
            variant="outline"
            {...props}
          />
        }
      >
        <CalendarIcon className="text-muted-foreground" />
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value
            ? dateFormatter.format(value)
            : (placeholder ?? t("calendar.pick_date"))}
        </span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          autoFocus
          defaultMonth={value}
          {...calendarProps}
          mode="single"
          onSelect={select}
          selected={value}
        />
        {allowClear && value ? (
          <div className="flex justify-end border-t p-2">
            <Button onClick={() => select(undefined)} size="sm" variant="ghost">
              {t("clear")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};

const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "long" };

export { DatePicker, type DatePickerProps };
