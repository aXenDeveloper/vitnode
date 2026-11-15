export const AI_OVERVIEW_PRESETS = [
  "this-month",
  "last-month",
  "7d",
  "30d",
  "90d",
] as const;

export type AiOverviewPreset = (typeof AI_OVERVIEW_PRESETS)[number];

export const AI_OVERVIEW_DEFAULT_PRESET: AiOverviewPreset = "this-month";

export const AI_OVERVIEW_MAX_DAYS = 366;

export interface AiDayRange {
  end: string;
  start: string;
}

export type AiCompareKind = "month-to-date" | "preceding" | "previous-month";

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);

const toDay = (date: Date) => date.toISOString().slice(0, 10);

export const isAiDay = (value: unknown): value is string =>
  typeof value === "string" &&
  DAY_PATTERN.test(value) &&
  !Number.isNaN(toDate(value).getTime()) &&
  toDay(toDate(value)) === value;

export const isAiMonth = (value: unknown): value is string =>
  typeof value === "string" &&
  MONTH_PATTERN.test(value) &&
  isAiDay(`${value}-01`);

export const isAiOverviewPreset = (value: unknown): value is AiOverviewPreset =>
  (AI_OVERVIEW_PRESETS as readonly unknown[]).includes(value);

export const addAiDays = (day: string, amount: number): string =>
  toDay(new Date(toDate(day).getTime() + amount * DAY_MS));

export const countAiDays = ({ end, start }: AiDayRange): number =>
  Math.round((toDate(end).getTime() - toDate(start).getTime()) / DAY_MS) + 1;

export const listAiDays = ({ end, start }: AiDayRange): string[] => {
  const days: string[] = [];
  for (let day = start; day <= end; day = addAiDays(day, 1)) days.push(day);

  return days;
};

export const aiMonthOf = (day: string): string => day.slice(0, 7);

export const shiftAiMonth = (month: string, amount: number): string => {
  const date = toDate(`${month}-01`);

  return toDay(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)),
  ).slice(0, 7);
};

export const aiMonthRange = (month: string): AiDayRange => ({
  end: addAiDays(`${shiftAiMonth(month, 1)}-01`, -1),
  start: `${month}-01`,
});

export const resolveAiPreset = (
  preset: AiOverviewPreset,
  today: string,
): AiDayRange => {
  switch (preset) {
    case "7d":
      return { end: today, start: addAiDays(today, -6) };
    case "30d":
      return { end: today, start: addAiDays(today, -29) };
    case "90d":
      return { end: today, start: addAiDays(today, -89) };
    case "last-month":
      return aiMonthRange(shiftAiMonth(aiMonthOf(today), -1));
    case "this-month":
      return { end: today, start: `${aiMonthOf(today)}-01` };
  }
};

export const matchAiPreset = (
  range: AiDayRange,
  today: string,
): AiOverviewPreset | null =>
  AI_OVERVIEW_PRESETS.find(preset => {
    const resolved = resolveAiPreset(preset, today);

    return resolved.start === range.start && resolved.end === range.end;
  }) ?? null;

export const resolveAiOverviewRange = ({
  from,
  preset,
  to,
  today,
}: {
  from?: unknown;
  preset?: unknown;
  to?: unknown;
  today: string;
}): { preset: AiOverviewPreset | null; range: AiDayRange } => {
  if (isAiDay(from) && isAiDay(to)) {
    const [first, last] = from <= to ? [from, to] : [to, from];
    const end = last > today ? today : last;
    const start = first > end ? end : first;
    const range = {
      end,
      start:
        countAiDays({ end, start }) > AI_OVERVIEW_MAX_DAYS
          ? addAiDays(end, 1 - AI_OVERVIEW_MAX_DAYS)
          : start,
    };

    return { preset: matchAiPreset(range, today), range };
  }

  const resolved = isAiOverviewPreset(preset)
    ? preset
    : AI_OVERVIEW_DEFAULT_PRESET;

  return { preset: resolved, range: resolveAiPreset(resolved, today) };
};

export const compareAiRange = (
  range: AiDayRange,
  today: string,
): { kind: AiCompareKind; range: AiDayRange } => {
  const month = aiMonthOf(range.start);
  const sameMonth = aiMonthOf(range.end) === month;
  const startsMonth = range.start === `${month}-01`;
  const previous = aiMonthRange(shiftAiMonth(month, -1));

  if (sameMonth && startsMonth && range.end === aiMonthRange(month).end) {
    return { kind: "previous-month", range: previous };
  }

  if (sameMonth && startsMonth && range.end === today) {
    const end = addAiDays(previous.start, countAiDays(range) - 1);

    return {
      kind: "month-to-date",
      range: {
        end: end > previous.end ? previous.end : end,
        start: previous.start,
      },
    };
  }

  const length = countAiDays(range);

  return {
    kind: "preceding",
    range: {
      end: addAiDays(range.start, -1),
      start: addAiDays(range.start, -length),
    },
  };
};
