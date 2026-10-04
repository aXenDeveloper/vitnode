import type { QueryClient } from "@tanstack/react-query";

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import type { CurrencyDisplay } from "@/payments/money";
import type {
  BillingInterval,
  DisputeStatus,
  FulfillmentStatus,
  OfferMode,
  PurchaseDisplayState,
  PurchasePaymentStatus,
  RefundStatus,
  SubscriptionDisplayState,
  SubscriptionStatus,
} from "@/payments/status";

import { CONFIG_PLUGIN } from "@/config";
import {
  OPERATIONAL_STALE_TIME,
  RECORD_STALE_TIME,
} from "@/lib/query-freshness";
import { readApiErrorMessage } from "@/lib/read-api-error";
import { fetcher } from "@/tanstack/fetcher";

type JsonDate = Date | string;

export interface PaymentsSettings {
  currencies: { code: string; currencyDisplay: CurrencyDisplay }[];
  defaultCurrency: null | string;
  defaultProvider: null | string;
  enabled: boolean;
  providers: {
    capabilities: {
      currencies: string[];
      customerPortal: boolean;
      intervals: BillingInterval[];
      oneTimePayments: boolean;
      subscriptions: boolean;
    };
    id: string;
    name: string;
  }[];
}

export interface PaymentOfferPrice {
  amount: number;
  currency: string;
  interval: BillingInterval | null;
}

export interface PaymentOfferSummary {
  id: string;
  mode: OfferMode;
  name: string;
  nameKey: null | string;
  pluginId: string;
  prices: PaymentOfferPrice[];
}

export interface Purchase {
  amount: number;
  createdAt: JsonDate;
  currency: string;
  displayState: PurchaseDisplayState;
  disputeStatus: DisputeStatus | null;
  fulfillmentStatus: FulfillmentStatus;
  id: string;
  interval: BillingInterval | null;
  mode: OfferMode;
  offerId: string;
  offerName: string;
  paidAt: JsonDate | null;
  paymentStatus: PurchasePaymentStatus;
  pluginId: string;
  provider: string;
  refundedAmount: number;
  refundStatus: RefundStatus;
}

export interface Subscription {
  amount: number;
  cancelAt: JsonDate | null;
  cancelAtPeriodEnd: boolean;
  createdAt: JsonDate;
  currency: string;
  currentPeriodEnd: JsonDate | null;
  displayState: SubscriptionDisplayState;
  endedAt: JsonDate | null;
  id: string;
  interval: BillingInterval;
  offerId: string;
  offerName: string;
  paidThrough: JsonDate | null;
  pluginId: string;
  provider: string;
  status: SubscriptionStatus;
}

interface Page<T> {
  edges: T[];
  pageInfo: { endCursor: null | string; hasNextPage: boolean };
}

/** An API refusal, with the server's `code` when it sent one. */
export class PaymentsRequestError extends Error {
  constructor(
    status: number,
    message: string,
    code: null | string,
    purchaseId: null | string,
  ) {
    super(message);
    this.name = "PaymentsRequestError";
    this.status = status;
    this.code = code;
    this.purchaseId = purchaseId;
  }

  readonly code: null | string;
  readonly purchaseId: null | string;
  readonly status: number;
}

export const isPaymentsRequestError = (
  error: unknown,
): error is PaymentsRequestError =>
  error instanceof Error && error.name === "PaymentsRequestError";

const toError = async (response: Response): Promise<PaymentsRequestError> => {
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  return new PaymentsRequestError(
    response.status,
    (await readApiErrorMessage(response)) ??
      `The payments API answered ${response.status}.`,
    typeof record.code === "string" ? record.code : null,
    typeof record.purchaseId === "string" ? record.purchaseId : null,
  );
};

/** Every billing cache entry hangs off this, keyed by the signed-in user. */
export const PAYMENTS_QUERY_ROOT = ["vitnode", "payments"] as const;

export const paymentsUserRoot = (userId: null | number) =>
  [...PAYMENTS_QUERY_ROOT, "user", userId] as const;

export const paymentsSettingsQueryOptions = () =>
  queryOptions({
    queryFn: async (): Promise<PaymentsSettings> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "payments",
        path: "/settings",
      });

      if (!response.ok) throw await toError(response);

      return await response.json();
    },
    queryKey: [...PAYMENTS_QUERY_ROOT, "settings"] as const,
    retry: false,
    staleTime: 5 * RECORD_STALE_TIME,
  });

export const paymentOffersQueryOptions = ({ pluginId }: { pluginId: string }) =>
  queryOptions({
    queryFn: async (): Promise<{
      enabled: boolean;
      offers: PaymentOfferSummary[];
    }> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { query: { pluginId } },
        method: "get",
        module: "payments",
        path: "/offers",
      });

      if (!response.ok) throw await toError(response);

      return await response.json();
    },
    queryKey: [...PAYMENTS_QUERY_ROOT, "offers", pluginId] as const,
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

const PAGE_SIZE = "10";

export const purchasesQueryOptions = ({ userId }: { userId: number }) =>
  infiniteQueryOptions({
    getNextPageParam: (page: Page<Purchase>) =>
      page.pageInfo.hasNextPage
        ? (page.pageInfo.endCursor ?? undefined)
        : undefined,
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam }): Promise<Page<Purchase>> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          query: pageParam
            ? { cursor: pageParam, first: PAGE_SIZE }
            : { first: PAGE_SIZE },
        },
        method: "get",
        module: "payments",
        path: "/purchases",
      });

      if (!response.ok) throw await toError(response);

      return await response.json();
    },
    // The user is in the key although the server reads them from the session:
    // signing in as someone else can never be served the previous account's cache.
    queryKey: [...paymentsUserRoot(userId), "purchases"] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const subscriptionsQueryOptions = ({ userId }: { userId: number }) =>
  infiniteQueryOptions({
    getNextPageParam: (page: Page<Subscription>) =>
      page.pageInfo.hasNextPage
        ? (page.pageInfo.endCursor ?? undefined)
        : undefined,
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam }): Promise<Page<Subscription>> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          query: pageParam
            ? { cursor: pageParam, first: PAGE_SIZE }
            : { first: PAGE_SIZE },
        },
        method: "get",
        module: "payments",
        path: "/subscriptions",
      });

      if (!response.ok) throw await toError(response);

      return await response.json();
    },
    queryKey: [...paymentsUserRoot(userId), "subscriptions"] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export interface PurchaseState {
  checkoutUrl: null | string;
  purchase: Purchase;
}

/** One purchase. `refresh` asks the server to check with the provider first. */
export const fetchPurchase = async (
  id: string,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<PurchaseState> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id }, query: refresh ? { refresh: "true" } : {} },
    method: "get",
    module: "payments",
    path: "/purchases/{id}",
  });

  if (!response.ok) throw await toError(response);

  return await response.json();
};

export interface StartCheckoutInput {
  currency: string;
  idempotencyKey: string;
  interval: BillingInterval | null;
  offerId: string;
  pluginId: string;
}

export const startCheckoutRequest = async (
  input: StartCheckoutInput,
): Promise<PurchaseState> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { body: input },
    method: "post",
    module: "payments",
    path: "/checkout",
  });

  if (!response.ok) throw await toError(response);

  return await response.json();
};

export const cancelPurchaseRequest = async (id: string): Promise<Purchase> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "post",
    module: "payments",
    path: "/purchases/{id}/cancel",
  });

  if (!response.ok) throw await toError(response);

  return (await response.json()).purchase;
};

export const openBillingPortalRequest = async (returnTo?: {
  offerId: string;
  pluginId: string;
}): Promise<string> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { body: returnTo ? { returnTo } : {} },
    method: "post",
    module: "payments",
    path: "/portal",
  });

  if (!response.ok) throw await toError(response);

  return (await response.json()).url;
};

/** After any billing change: drop every cached billing record of this user. */
export const invalidateBilling = async (
  queryClient: QueryClient,
  userId: null | number,
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: paymentsUserRoot(userId) });
};
