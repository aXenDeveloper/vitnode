import React from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { formatAiUsd } from "@/lib/ai/format-points";
import { countAiDays } from "@/lib/ai/overview-range";

import type { AdminAiOverview } from "../ai-query";
import type { AiMetricFormat } from "./overview-metrics";

import { dayAsDate } from "./overview-metrics";

export const useOverviewFormat = () => {
  const locale = useLocale();
  const format = useFormatter();

  return React.useMemo(() => {
    const usd = (value: number) => formatAiUsd(String(value), locale);
    const usdAxis = (value: number) =>
      new Intl.NumberFormat(locale, {
        currency: "USD",
        style: "currency",
        ...(value !== 0 && Math.abs(value) < 0.01
          ? { maximumSignificantDigits: 2 }
          : { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0 }),
      }).format(value);
    const percentFormats = new Map<number, Intl.NumberFormat>();
    const percent = (value: number, digits = 1) => {
      let formatter = percentFormats.get(digits);
      if (!formatter) {
        formatter = new Intl.NumberFormat(locale, {
          maximumFractionDigits: digits,
          style: "percent",
        });
        percentFormats.set(digits, formatter);
      }

      return formatter.format(value);
    };
    const countFormat = new Intl.NumberFormat(locale);
    const count = (value: number) => countFormat.format(Math.round(value));
    const compactFormat = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      notation: "compact",
    });
    const compact = (value: number) => compactFormat.format(value);

    const usdNumberFormat = (maximumFractionDigits: number) =>
      new Intl.NumberFormat(locale, {
        currency: "USD",
        maximumFractionDigits,
        minimumFractionDigits: 2,
        style: "currency",
      });
    const metricNumberFormats = {
      count: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      percent: new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
        style: "percent",
      }),
      tokens: new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
        notation: "compact",
      }),
      usd: usdNumberFormat(2),
      usdFraction: usdNumberFormat(6),
    };
    const numberFormat = (kind: AiMetricFormat, value: number) =>
      kind === "usd" && value !== 0 && Math.abs(value) < 0.01
        ? metricNumberFormats.usdFraction
        : metricNumberFormats[kind];
    const metric = (kind: AiMetricFormat) => (value: number) => {
      switch (kind) {
        case "count":
          return count(value);
        case "percent":
          return percent(value, 2);
        case "tokens":
          return compact(value);
        case "usd":
          return usd(value);
      }
    };
    const axis = (kind: AiMetricFormat) => {
      if (kind === "usd") return usdAxis;
      const format = metric(kind);
      if (kind === "percent") return format;

      return (value: number) => (Number.isInteger(value) ? format(value) : "");
    };

    return {
      axis,
      day: (day: string) =>
        format.dateTime(dayAsDate(day), {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }),
      dayLong: (day: string) =>
        format.dateTime(dayAsDate(day), {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
          weekday: "short",
        }),
      metric,
      numberFormat,
      month: (month: string) =>
        format.dateTime(dayAsDate(`${month}-01`), {
          month: "long",
          timeZone: "UTC",
          year: "numeric",
        }),
      percent,
      range: (start: string, end: string) =>
        start === end
          ? format.dateTime(dayAsDate(start), {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })
          : format
              .dateTimeRange(dayAsDate(start), dayAsDate(end), {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })
              .replace(/[\u2009\u202f]/g, " "),
      usd,
      usdAxis,
    };
  }, [format, locale]);
};

export const useCompareLabel = (data: AdminAiOverview): string => {
  const t = useTranslations("admin.ai.overview.compare");
  const formatter = useOverviewFormat();
  const { compare, range } = data;

  if (compare.kind === "previous-month") {
    return t("month", { month: formatter.month(compare.start.slice(0, 7)) });
  }

  if (compare.kind === "preceding" && range.preset !== null) {
    return t("previous_days", { count: countAiDays(range) });
  }

  return t("range", { range: formatter.range(compare.start, compare.end) });
};
