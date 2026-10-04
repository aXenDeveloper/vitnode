import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { and, gte, inArray } from "drizzle-orm";
import { z } from "zod";

/** Relative windows the AdminCP filters by - days back from now. */
export const PAYMENT_PERIODS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
} as const;
export type PaymentPeriod = keyof typeof PAYMENT_PERIODS;

/** Comma-separated values, each one checked; anything else is dropped. */
export const commaList = <T extends string>(
  raw: string | undefined,
  accept: (value: string) => value is T,
): T[] => [...new Set((raw ?? "").split(",").filter(accept))];

export const zodPaymentsAdminFilters = z.object({
  currency: z.string().max(200).optional(),
  period: z.string().max(50).optional(),
  provider: z.string().max(200).optional(),
});

const isCurrency = (value: string): value is string => /^[A-Z]{3}$/.test(value);
const isProvider = (value: string): value is string =>
  /^[a-z0-9-]{1,32}$/.test(value);
const isPeriod = (value: string): value is PaymentPeriod =>
  value in PAYMENT_PERIODS;

/** The shared currency / provider / period filters as one condition. */
export const commonPaymentFilters = (
  query: z.infer<typeof zodPaymentsAdminFilters>,
  columns: { createdAt: PgColumn; currency: PgColumn; provider: PgColumn },
  now = new Date(),
): SQL | undefined => {
  const currencies = commaList(query.currency, isCurrency);
  const providers = commaList(query.provider, isProvider);
  // Several windows selected means the widest of them.
  const days = Math.max(
    0,
    ...commaList(query.period, isPeriod).map(period => PAYMENT_PERIODS[period]),
  );

  return and(
    currencies.length ? inArray(columns.currency, currencies) : undefined,
    providers.length ? inArray(columns.provider, providers) : undefined,
    days
      ? gte(columns.createdAt, new Date(now.getTime() - days * 86_400_000))
      : undefined,
  );
};
