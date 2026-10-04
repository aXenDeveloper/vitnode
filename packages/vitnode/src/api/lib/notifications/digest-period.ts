export type DigestMode = "daily" | "weekly";

export interface LocalDate {
  day: number;
  month: number;
  year: number;
}

export interface DigestPeriod {
  end: Date;
  /** The local calendar date the digest belongs to, e.g. `2026-10-04`. */
  key: string;
  start: Date;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "numeric",
      hourCycle: "h23",
      minute: "numeric",
      month: "numeric",
      second: "numeric",
      timeZone,
      weekday: "short",
      year: "numeric",
    });
    formatters.set(timeZone, formatter);
  }

  return formatter;
};

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    formatterFor(timeZone);

    return true;
  } catch {
    return false;
  }
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WallClock extends LocalDate {
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

export const wallClockAt = (instant: Date, timeZone: string): WallClock => {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map(part => [part.type, part.value]),
  );

  return {
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    month: Number(parts.month),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday ?? "Sun"),
    year: Number(parts.year),
  };
};

const offsetAt = (instant: number, timeZone: string): number => {
  const wall = wallClockAt(new Date(instant), timeZone);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );

  return asUtc - Math.floor(instant / 1000) * 1000;
};

/**
 * The instant a local wall-clock hour happens in `timeZone`. On the night
 * clocks jump forward the hour may not exist; the answer is then the first
 * instant after the gap. On the night they fall back it happens twice; the
 * earlier one wins. Either way each local date maps to exactly one instant.
 */
export const zonedHourToUtc = (
  date: LocalDate,
  hour: number,
  timeZone: string,
): Date => {
  const wall = Date.UTC(date.year, date.month - 1, date.day, hour);
  const before = offsetAt(wall - 12 * 60 * 60 * 1000, timeZone);
  const after = offsetAt(wall + 12 * 60 * 60 * 1000, timeZone);

  const candidates = [
    wall - Math.max(before, after),
    wall - Math.min(before, after),
  ]
    .filter(instant => offsetAt(instant, timeZone) === wall - instant)
    .sort((a, b) => a - b);

  if (candidates[0] !== undefined) return new Date(candidates[0]);

  // A gap: the wall time never happens. Use the instant clocks jump to.
  return new Date(wall - before);
};

const addDays = (date: LocalDate, days: number): LocalDate => {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + days),
  );

  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
};

const formatLocalDate = (date: LocalDate): string =>
  `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

/**
 * The most recent digest period that has already ended at `now`. A daily digest
 * ends every local day at `hour`; a weekly one on `weekday` at `hour`. Periods
 * are contiguous, so on DST days a daily period is 23 or 25 hours long rather
 * than skipping or repeating a day.
 */
export const latestEndedDigestPeriod = ({
  hour,
  mode,
  now,
  timeZone,
  weekday,
}: {
  hour: number;
  mode: DigestMode;
  now: Date;
  timeZone: string;
  weekday: number;
}): DigestPeriod => {
  const today = wallClockAt(now, timeZone);
  let date: LocalDate = today;

  if (mode === "weekly") {
    date = addDays(today, -((today.weekday - weekday + 7) % 7));
  }

  const step = mode === "daily" ? 1 : 7;
  let end = zonedHourToUtc(date, hour, timeZone);
  if (end.getTime() > now.getTime()) {
    date = addDays(date, -step);
    end = zonedHourToUtc(date, hour, timeZone);
  }

  return {
    end,
    key: formatLocalDate(date),
    start: zonedHourToUtc(addDays(date, -step), hour, timeZone),
  };
};
