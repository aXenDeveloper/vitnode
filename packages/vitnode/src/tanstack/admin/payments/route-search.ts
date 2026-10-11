import type { AdminTableContract } from "@/views/admin/table/params";

import { asSearchValue } from "@/lib/table-params";
import {
  EVENTS_TABLE_CONTRACT,
  type EventsAdminParams,
  FULFILLMENT_STATUSES,
  PAYMENT_PERIOD_FILTERS,
  type PaymentsListFilters,
  PURCHASES_TABLE_CONTRACT,
  type PurchasesAdminParams,
  SUBSCRIPTIONS_TABLE_CONTRACT,
  type SubscriptionsAdminParams,
} from "@/views/admin/views/core/payments/payments-admin-query";

import type { AdminTableRouteSearch } from "../table-search";

import {
  adminTableRouteParams,
  adminTableSearchFrom,
  adminTableSearchParams,
  normalizeAdminTableSearch,
} from "../table-search";

type Unchecked = Record<string, unknown>;

const FILTER_KEYS = ["currency", "fulfillment", "period", "provider"] as const;

/** One comma-separated filter, each value checked and sorted for a stable key. */
const readList = (
  raw: unknown,
  accept: (value: string) => boolean,
): string | undefined => {
  const value = asSearchValue(raw);
  if (value === undefined) return undefined;

  const values = [...new Set(value.split(",").filter(accept))].sort((a, b) =>
    a.localeCompare(b),
  );

  return values.length ? values.join(",") : undefined;
};

/** The payments filters on top of the shared table contract - all validated. */
const paymentFilters = (
  input: Unchecked,
  { fulfillment }: { fulfillment: boolean },
): PaymentsListFilters => {
  const record = input as Record<string, unknown>;
  const filters: PaymentsListFilters = {
    currency: readList(record.currency, value => /^[A-Z]{3}$/.test(value)),
    fulfillment: fulfillment
      ? readList(record.fulfillment, value =>
          (FULFILLMENT_STATUSES as readonly string[]).includes(value),
        )
      : undefined,
    period: readList(record.period, value =>
      (PAYMENT_PERIOD_FILTERS as readonly string[]).includes(value),
    ),
    provider: readList(record.provider, value =>
      /^[a-z0-9-]{1,32}$/.test(value),
    ),
  };

  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  );
};

const searchWithFilters = <TOrderBy extends string>(
  contract: AdminTableContract<TOrderBy>,
  options: { fulfillment: boolean },
) => {
  const normalize = (input: Unchecked) => ({
    ...normalizeAdminTableSearch(input, contract),
    ...paymentFilters(input, options),
  });

  return {
    from: (nextSearch: string) =>
      normalize(Object.fromEntries(new URLSearchParams(nextSearch))),
    normalize,
    params: (input: Unchecked) => ({
      ...adminTableRouteParams<TOrderBy>(input, contract),
      ...paymentFilters(input, options),
    }),
    searchParams: (input: Unchecked) => {
      const params = adminTableSearchParams(input, contract);
      const filters = paymentFilters(input, options);
      for (const key of FILTER_KEYS) {
        const value = filters[key];
        if (value !== undefined) params.set(key, value);
      }

      return params;
    },
  };
};

export type PaymentsTableRouteSearch = AdminTableRouteSearch &
  PaymentsListFilters;

export const purchasesSearch = searchWithFilters(PURCHASES_TABLE_CONTRACT, {
  fulfillment: true,
});
export const subscriptionsSearch = searchWithFilters(
  SUBSCRIPTIONS_TABLE_CONTRACT,
  {
    fulfillment: false,
  },
);

export const normalizePurchasesRouteSearch = (
  input: Unchecked,
): PaymentsTableRouteSearch => purchasesSearch.normalize(input);
export const purchasesRouteParams = (input: Unchecked): PurchasesAdminParams =>
  purchasesSearch.params(input);

export const normalizeSubscriptionsRouteSearch = (
  input: Unchecked,
): PaymentsTableRouteSearch => subscriptionsSearch.normalize(input);
export const subscriptionsRouteParams = (
  input: Unchecked,
): SubscriptionsAdminParams => subscriptionsSearch.params(input);

export const normalizeEventsRouteSearch = (
  input: Unchecked,
): AdminTableRouteSearch =>
  normalizeAdminTableSearch(input, EVENTS_TABLE_CONTRACT);
export const eventsRouteParams = (input: Unchecked): EventsAdminParams =>
  adminTableRouteParams<"receivedAt">(input, EVENTS_TABLE_CONTRACT);
export const eventsSearchParams = (input: Unchecked): URLSearchParams =>
  adminTableSearchParams(input, EVENTS_TABLE_CONTRACT);
export const eventsSearchFrom = (nextSearch: string): AdminTableRouteSearch =>
  adminTableSearchFrom(nextSearch, EVENTS_TABLE_CONTRACT);
