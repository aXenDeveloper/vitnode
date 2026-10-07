import { cn } from "cn";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { useIsMobile } from "@/hooks/use-mobile";

import { Button } from "./button";
import { Calendar, type DateRange, type Matcher } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DateRangeValue {
  from: Date;
  to: Date;
}

export interface DateRangePreset<TKey extends string = string> {
  key: TKey;
  label: string;
}

type DateRangePickerProps<TKey extends string> = Omit<
  React.ComponentProps<"button">,
  "children" | "defaultValue" | "onChange" | "value"
> & {
  activePreset?: null | TKey;
  align?: "center" | "end" | "start";
  disabledDays?: Matcher | Matcher[];
  endMonth?: Date;
  onChange: (range: DateRangeValue) => void;
  onPresetSelect?: (preset: TKey) => void;
  presets?: readonly DateRangePreset<TKey>[];
  startMonth?: Date;
  value: DateRangeValue;
};

const startOfMonth = (date: Date, offset = 0) =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1);

const dayCount = ({ from, to }: DateRangeValue) =>
  Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000,
  ) + 1;

const DateRangePicker = <TKey extends string>({
  activePreset,
  align = "end",
  className,
  disabledDays,
  endMonth,
  onChange,
  onPresetSelect,
  presets = [],
  startMonth,
  value,
  ...props
}: DateRangePickerProps<TKey>) => {
  const t = useTranslations("core.global");
  const locale = useLocale();
  const mobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>();

  const format = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const describe = (range: DateRangeValue) =>
    format.formatRange(range.from, range.to).replace(/[\u2009\u202f]/g, " ");

  const draftRange: DateRangeValue | null = draft?.from
    ? { from: draft.from, to: draft.to ?? draft.from }
    : null;
  const months = mobile ? 1 : 2;
  const latest = endMonth ? startOfMonth(endMonth) : null;
  const afterEnd = startOfMonth(value.to, 1);
  const rightMonth =
    latest && latest.getTime() < afterEnd.getTime() ? latest : afterEnd;
  const defaultMonth =
    months === 2 ? startOfMonth(rightMonth, -1) : startOfMonth(value.to);
  const presetLabel = presets.find(
    preset => preset.key === activePreset,
  )?.label;

  return (
    <Popover
      onOpenChange={next => {
        if (next) setDraft({ from: value.from, to: value.to });
        setOpen(next);
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button
            className={cn("min-w-52 justify-start font-normal", className)}
            variant="outline"
            {...props}
          />
        }
      >
        <CalendarIcon className="text-muted-foreground" />
        <span className="truncate">{presetLabel ?? describe(value)}</span>
        <ChevronDownIcon className="text-muted-foreground ms-auto" />
      </PopoverTrigger>

      <PopoverContent align={align} className="w-min gap-0 p-0">
        <div className="flex flex-col sm:flex-row">
          {presets.length > 0 ? (
            <div
              aria-label={t("calendar.presets")}
              className="flex flex-wrap gap-1 border-b p-2 sm:flex-col sm:flex-nowrap sm:border-e sm:border-b-0"
              role="group"
            >
              {presets.map(preset => (
                <Button
                  aria-pressed={preset.key === activePreset}
                  className={cn(
                    "shrink-0 justify-start",
                    preset.key === activePreset &&
                      "bg-accent text-accent-foreground",
                  )}
                  key={preset.key}
                  onClick={() => {
                    onPresetSelect?.(preset.key);
                    setOpen(false);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col">
            <Calendar
              autoFocus
              defaultMonth={defaultMonth}
              disabled={disabledDays}
              endMonth={endMonth}
              mode="range"
              numberOfMonths={months}
              onSelect={setDraft}
              resetOnSelect
              selected={draft}
              showOutsideDays={false}
              startMonth={startMonth}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
              <p
                aria-live="polite"
                className="text-muted-foreground text-sm tabular-nums"
              >
                {draftRange
                  ? `${describe(draftRange)} · ${t("calendar.range_days", {
                      count: dayCount(draftRange),
                    })}`
                  : t("calendar.pick_range")}
              </p>
              <div className="flex w-full gap-2 [&>button]:flex-1">
                <Button
                  onClick={() => {
                    setOpen(false);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {t("cancel")}
                </Button>
                <Button
                  disabled={!draftRange}
                  onClick={() => {
                    if (!draftRange) return;
                    onChange(draftRange);
                    setOpen(false);
                  }}
                  size="sm"
                >
                  {t("calendar.apply_range")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { DateRangePicker, type DateRangePickerProps };
