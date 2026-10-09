import { cn } from "cn";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import React from "react";
import {
  type Chevron,
  type DayButton,
  DayPicker,
  type Root as DayPickerRoot,
  getDefaultClassNames,
  type WeekNumber,
} from "react-day-picker";
import { useLocale, useTranslations } from "use-intl";

import { type ButtonProps, buttonVariants } from "./button";
import { getFirstDayOfWeek, toDateString } from "./calendar-utils";

type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: ButtonProps["variant"];
};

const CalendarRoot = ({
  className,
  rootRef,
  ...props
}: React.ComponentProps<typeof DayPickerRoot>) => (
  <div
    className={cn(className)}
    data-slot="calendar"
    ref={rootRef}
    {...props}
  />
);

const CalendarChevron = ({
  className,
  orientation,
  ...props
}: React.ComponentProps<typeof Chevron>) => {
  if (orientation === "left") {
    return (
      <ChevronLeftIcon
        className={cn("size-4 rtl:rotate-180", className)}
        {...props}
      />
    );
  }

  if (orientation === "right") {
    return (
      <ChevronRightIcon
        className={cn("size-4 rtl:rotate-180", className)}
        {...props}
      />
    );
  }

  return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
};

const CalendarWeekNumber = ({
  children,
  ...props
}: React.ComponentProps<typeof WeekNumber>) => (
  <td {...props}>
    <div className="flex size-(--cell-size) items-center justify-center text-center">
      {children}
    </div>
  </td>
);

const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  labels,
  ...props
}: CalendarProps) => {
  const t = useTranslations("core.global.calendar");
  const intlLocale = useLocale();
  const defaultClassNames = getDefaultClassNames();
  const followsIntlLocale = !locale;
  const formatIntl = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocale, options).format(date);
  const formatCaption = (month: Date) =>
    formatIntl(month, { month: "long", year: "numeric" });

  return (
    <DayPicker
      captionLayout={captionLayout}
      className={cn(
        "group/calendar not-prose bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(8)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        className,
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months,
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus-visible:ring-ring/50 relative rounded-(--cell-radius) has-focus-visible:ring-3",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          "bg-popover absolute inset-0 cursor-pointer opacity-0",
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-(--cell-radius) ps-2 pe-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 rounded-(--cell-radius) text-xs font-normal select-none",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          "text-muted-foreground text-xs select-none",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-e-(--cell-radius)",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-s-(--cell-radius)"
            : "[&:first-child[data-selected=true]_button]:rounded-s-(--cell-radius)",
          defaultClassNames.day,
        ),
        range_start: cn(
          "bg-primary/15 after:bg-primary/15 relative isolate z-0 rounded-s-(--cell-radius) after:absolute after:inset-y-0 after:end-0 after:w-4",
          defaultClassNames.range_start,
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "bg-primary/15 after:bg-primary/15 relative isolate z-0 rounded-e-(--cell-radius) after:absolute after:inset-y-0 after:start-0 after:w-4",
          defaultClassNames.range_end,
        ),
        today: cn(
          "not-data-[selected=true]:bg-muted text-foreground rounded-(--cell-radius) data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: CalendarRoot,
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        WeekNumber: CalendarWeekNumber,
        ...components,
      }}
      formatters={{
        formatMonthDropdown: date =>
          followsIntlLocale
            ? formatIntl(date, { month: "short" })
            : date.toLocaleString(locale.code, { month: "short" }),
        ...(followsIntlLocale && {
          formatCaption,
          formatWeekdayName: date => formatIntl(date, { weekday: "short" }),
        }),
        ...formatters,
      }}
      labels={{
        ...(followsIntlLocale && {
          labelGrid: formatCaption,
          labelWeekday: date => formatIntl(date, { weekday: "long" }),
          labelDayButton: (date, modifiers) =>
            [
              formatIntl(date, { dateStyle: "full" }),
              modifiers.today && t("today"),
              modifiers.selected && t("selected"),
            ]
              .filter(Boolean)
              .join(", "),
        }),
        labelPrevious: () => t("previous_month"),
        labelNext: () => t("next_month"),
        labelMonthDropdown: () => t("month"),
        labelYearDropdown: () => t("year"),
        labelNav: () => t("navigation"),
        labelWeekNumber: week => t("week_number", { week }),
        labelWeekNumberHeader: () => t("week_number_header"),
        ...labels,
      }}
      locale={locale}
      showOutsideDays={showOutsideDays}
      weekStartsOn={
        followsIntlLocale ? getFirstDayOfWeek(intlLocale) : undefined
      }
      {...props}
    />
  );
};

const CalendarDayButton = ({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) => {
  const defaultClassNames = getDefaultClassNames();
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:bg-primary/15 data-[range-middle=true]:text-foreground data-[range-middle=true]:hover:bg-primary/25 data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-3 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-e-(--cell-radius) data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-s-(--cell-radius) [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      data-day={toDateString(day.date)}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      ref={ref}
      type="button"
      {...props}
    />
  );
};

export { Calendar, CalendarDayButton, type CalendarProps };
export type { DateRange, Matcher } from "react-day-picker";
