const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

type WeekDay = (typeof WEEK_DAYS)[number];

const readWeekInfo = (locale: Intl.Locale): unknown => {
  if ("getWeekInfo" in locale && typeof locale.getWeekInfo === "function") {
    return locale.getWeekInfo();
  }

  return "weekInfo" in locale ? locale.weekInfo : undefined;
};

const readFirstDay = (locale: Intl.Locale): unknown => {
  const info = readWeekInfo(locale);

  return info && typeof info === "object" && "firstDay" in info
    ? info.firstDay
    : undefined;
};

export const getFirstDayOfWeek = (locale: string): undefined | WeekDay => {
  const firstDay = readFirstDay(new Intl.Locale(locale));

  return typeof firstDay === "number" ? WEEK_DAYS[firstDay % 7] : undefined;
};

const pad = (part: number) => String(part).padStart(2, "0");

export const toDateString = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const DATE_STRING = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseDateString = (value: unknown): Date | undefined => {
  if (typeof value !== "string") return undefined;
  const match = DATE_STRING.exec(value);
  if (!match) return undefined;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return toDateString(date) === value ? date : undefined;
};
