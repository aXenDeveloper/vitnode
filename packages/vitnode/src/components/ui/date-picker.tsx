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
  /** Adds a "Clear" button to the popover, shown while a date is set, that calls `onChange` with `undefined`. */
  allowClear?: boolean;
  /** Extra props for the {@link Calendar} in the popover. */
  calendarProps?: Omit<
    Extract<CalendarProps, { mode: "single" }>,
    "mode" | "onSelect" | "selected"
  >;
  /**
   * How the trigger shows the date, in the UI language. Defaults to `{
   * dateStyle: "long" }`.
   */
  dateFormat?: Intl.DateTimeFormatOptions;
  /** Called with the picked date; the popover closes. */
  onChange?: (date: Date | undefined) => void;
  /** Shown while empty. Defaults to the translated "Pick a date". */
  placeholder?: string;
  /** The selected date. */
  value?: Date;
};

/**
 * An outline button that opens a {@link Calendar} for one date. Its `onBlur`
 * fires only while the popover is closed, so opening the calendar does not
 * count as leaving the field.
 */
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
