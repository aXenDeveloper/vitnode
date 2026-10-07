/**
 * Calendar periods in the site's time zone, stored as UTC instants. A monthly
 * allowance resets at local midnight on the 1st, wherever the server runs.
 */

export type AiPeriodKind = "day" | "month";

export interface AiPeriod {
  end: Date;
  start: Date;
}

interface LocalParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "numeric",
      hourCycle: "h23",
      minute: "numeric",
      month: "numeric",
      second: "numeric",
      timeZone,
      year: "numeric",
    });
    formatterCache.set(timeZone, formatter);
  }

  return formatter;
};

const localParts = (date: Date, timeZone: string): LocalParts => {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, Number(part.value)]),
  );

  return {
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    month: parts.month,
    second: parts.second,
    year: parts.year,
  };
};

/** Milliseconds the zone is ahead of UTC at `date`. */
const offsetAt = (date: Date, timeZone: string): number => {
  const parts = localParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/** The UTC instant of a local wall-clock midnight. Handles DST shifts. */
const zonedMidnight = (
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date => {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetAt(new Date(guess), timeZone);

  return new Date(guess - offsetAt(new Date(first), timeZone));
};

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    formatterFor(timeZone);

    return true;
  } catch {
    return false;
  }
};

export const periodContaining = (
  now: Date,
  kind: AiPeriodKind,
  timeZone = "UTC",
): AiPeriod => {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const { day, month, year } = localParts(now, zone);

  if (kind === "day") {
    const next = new Date(Date.UTC(year, month - 1, day + 1));

    return {
      start: zonedMidnight(year, month, day, zone),
      end: zonedMidnight(
        next.getUTCFullYear(),
        next.getUTCMonth() + 1,
        next.getUTCDate(),
        zone,
      ),
    };
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return {
    start: zonedMidnight(year, month, 1, zone),
    end: zonedMidnight(nextYear, nextMonth, 1, zone),
  };
};

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export const localDayOf = (date: Date, timeZone = "UTC"): string => {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const { day, month, year } = localParts(date, zone);

  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
};

export const localDayStart = (day: string, timeZone = "UTC"): Date => {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);

  return zonedMidnight(year, month, date, zone);
};
