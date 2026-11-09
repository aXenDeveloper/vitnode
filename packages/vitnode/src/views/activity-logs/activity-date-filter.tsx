import React from "react";
import { useNow, useTranslations } from "use-intl";

import type { DateRange } from "@/components/ui/calendar";
import type { DateRangeValue } from "@/components/ui/date-range-picker";

import { useDataTableUrl } from "@/components/table/navigation";
import { Calendar } from "@/components/ui/calendar";
import { DateRangePicker } from "@/components/ui/date-range-picker";

import type { ActivityRange } from "./activity-search";

import { OptionChip } from "./activity-filters-drawer";
import { ACTIVITY_RANGES, activityRangeDays } from "./activity-search";

type DatePreset = "any" | ActivityRange;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const fromDay = (day: null | string) => {
  if (!day || !DAY.test(day)) return null;
  const [year, month, date] = day.split("-").map(Number);

  return new Date(year, month - 1, date);
};

const daysBack = (today: Date, days: number): DateRangeValue => ({
  from: new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - days + 1,
  ),
  to: today,
});

const rangeValue = (range: ActivityRange, today: Date): DateRangeValue => {
  const days = activityRangeDays(range, today);

  return {
    from: fromDay(days.from) ?? today,
    to: fromDay(days.to ?? null) ?? today,
  };
};

const isRange = (value: null | string): value is ActivityRange =>
  ACTIVITY_RANGES.some(range => range === value);

/** The log's date filter in the URL: a preset (`range`) or a custom `from`/`to`. */
const useActivityDateFilter = () => {
  const { navigate, searchParams } = useDataTableUrl();
  const today = useNow();
  const range = searchParams.get("range");
  const from = fromDay(searchParams.get("from"));
  const to = fromDay(searchParams.get("to"));

  const preset: DatePreset | null = isRange(range)
    ? range
    : from || to
      ? null
      : "any";
  const value: DateRangeValue = isRange(range)
    ? rangeValue(range, today)
    : from || to
      ? { from: from ?? to ?? today, to: to ?? today }
      : daysBack(today, 30);

  const write = (next: {
    from?: string;
    range?: ActivityRange;
    to?: string;
  }) => {
    const params = new URLSearchParams(searchParams);
    for (const key of ["range", "from", "to", "page", "log"]) {
      params.delete(key);
    }
    for (const [key, entry] of Object.entries(next)) {
      if (entry) params.set(key, entry);
    }
    navigate(params.toString());
  };

  return {
    isActive: preset !== "any",
    preset,
    setPreset: (key: DatePreset) => {
      write(key === "any" ? {} : { range: key });
    },
    setRange: (next: DateRangeValue) => {
      write({ from: toDay(next.from), to: toDay(next.to) });
    },
    today,
    value,
  };
};

const usePresets = () => {
  const t = useTranslations("core.activity_logs.filters");

  return [
    { key: "any" as const, label: t("any_time") },
    ...ACTIVITY_RANGES.map(range => ({
      key: range,
      label: t(`ranges.${range}`),
    })),
  ];
};

/**
 * The toolbar's date filter on a wide screen: the range calendar from the UI
 * kit with the log's presets beside it. A custom range is written to the URL
 * as `from` and `to`, a preset as `range`.
 */
export const ActivityDateRangeFilter = () => {
  const t = useTranslations("core.activity_logs.filters");
  const date = useActivityDateFilter();
  const presets = usePresets();
  const { today } = date;

  return (
    <DateRangePicker
      activePreset={date.preset}
      align="end"
      aria-label={t("date")}
      className={date.isActive ? undefined : "border-dashed"}
      disabledDays={{ after: today }}
      endMonth={today}
      onChange={date.setRange}
      onPresetSelect={date.setPreset}
      presets={presets}
      value={date.value}
    />
  );
};

/**
 * The date filter inside the phone's filters drawer: the presets as chips and
 * a "Custom range" chip that opens the range calendar in place. A range
 * applies once both ends are picked.
 */
export const ActivityDateDrawerSection = () => {
  const t = useTranslations("core.activity_logs.filters");
  const date = useActivityDateFilter();
  const presets = usePresets();
  const headingId = React.useId();
  const [isCustom, setIsCustom] = React.useState(date.preset === null);
  const [draft, setDraft] = React.useState<DateRange | undefined>(
    date.preset === null
      ? { from: date.value.from, to: date.value.to }
      : undefined,
  );
  const { today } = date;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 className="text-sm font-medium" id={headingId}>
        {t("date")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {presets.map(preset => (
          <OptionChip
            isSelected={!isCustom && date.preset === preset.key}
            key={preset.key}
            onSelect={() => {
              setIsCustom(false);
              setDraft(undefined);
              date.setPreset(preset.key);
            }}
          >
            {preset.label}
          </OptionChip>
        ))}
        <OptionChip
          isSelected={isCustom}
          onSelect={() => {
            setIsCustom(true);
          }}
        >
          {t("custom_range")}
        </OptionChip>
      </div>
      {isCustom ? (
        <div className="flex justify-center">
          <Calendar
            className="bg-transparent p-0"
            defaultMonth={draft?.from ?? today}
            disabled={{ after: today }}
            endMonth={today}
            mode="range"
            onSelect={next => {
              setDraft(next);
              if (next?.from && next.to) {
                date.setRange({ from: next.from, to: next.to });
              }
            }}
            resetOnSelect
            selected={draft}
            showOutsideDays={false}
          />
        </div>
      ) : null}
    </section>
  );
};
