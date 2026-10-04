import { queryOptions } from "@tanstack/react-query";

import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
} from "@/views/admin/table/params";
import type { Purchase, Subscription } from "@/views/payments/payments-query";

import { CONFIG_PLUGIN } from "@/config";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import {
  FULFILLMENT_STATUSES,
  PURCHASE_PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
} from "@/payments/status";
import { fetcher } from "@/tanstack/fetcher";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

type JsonDate = Date | string;

export const PAYMENT_PERIOD_FILTERS = ["7d", "30d", "90d", "365d"] as const;

/** Filters payments lists add on top of the shared admin table contract. */
export interface PaymentsListFilters {
  currency?: string;
  fulfillment?: string;
  period?: string;
  provider?: string;
}

export const PURCHASES_TABLE_CONTRACT: AdminTableContract<
  "amount" | "createdAt"
> = {
  orderBy: ["createdAt", "amount"],
  status: PURCHASE_PAYMENT_STATUSES,
};

export const SUBSCRIPTIONS_TABLE_CONTRACT: AdminTableContract<
  "createdAt" | "paidThrough"
> = {
  orderBy: ["createdAt", "paidThrough"],
  status: SUBSCRIPTION_STATUSES,
};

export const EVENTS_TABLE_CONTRACT: AdminTableContract<"receivedAt"> = {
  orderBy: ["receivedAt"],
  status: ["pending", "processed", "failed"],
};

export { FULFILLMENT_STATUSES };

export type PurchasesAdminParams = AdminTableParams<"amount" | "createdAt"> &
  PaymentsListFilters;
export type SubscriptionsAdminParams = AdminTableParams<
  "createdAt" | "paidThrough"
> &
  PaymentsListFilters;
export type EventsAdminParams = AdminTableParams<"receivedAt">;

export interface AdminPurchaseRow extends Omit<Purchase, "id"> {
  id: number;
  lastError: null | string;
  providerScope: string;
  publicId: string;
  user: null | { id: number; name: string };
}

export interface AdminSubscriptionRow extends Omit<Subscription, "id"> {
  id: number;
  lastError: null | string;
  publicId: string;
  purchaseId: string;
  user: null | { id: number; name: string };
}

export interface AdminWebhookEventRow {
  attempts: number;
  externalId: string;
  id: number;
  lastError: null | string;
  processedAt: JsonDate | null;
  provider: string;
  providerScope: string;
  receivedAt: JsonDate;
  status: "failed" | "pending" | "processed";
  targetId: string;
  targetKind: string;
  type: string;
}

export interface PaymentsOverview {
  attention: {
    disputesOpen: number;
    eventsFailed: number;
    fulfillmentsFailed: number;
    fulfillmentsPending: number;
    purchasesProcessing: number;
    subscriptionsNeedingAttention: number;
  };
  enabled: boolean;
  providers: { id: string; name: string; scope: string }[];
  totals: {
    currency: string;
    oneTime: number;
    recurring: number;
    refunded: number;
  }[];
  worker: {
    hasCronAdapter: boolean;
    lastRun: JsonDate | null;
    queueLagging: number;
    stale: boolean;
  };
}

export interface AdminPurchaseDetail {
  adjustments: {
    amount: number;
    createdAt: JsonDate;
    currency: string;
    externalId: string;
    invoiceId: null | number;
    kind: "dispute" | "refund";
    reason: null | string;
    status: string;
  }[];
  checkouts: {
    createdAt: JsonDate;
    expiresAt: JsonDate;
    externalId: null | string;
    lastError: null | string;
    status: string;
  }[];
  externalCustomerId: null | string;
  externalPaymentId: null | string;
  fulfillments: {
    attempts: number;
    completedAt: JsonDate | null;
    effect: string;
    id: number;
    lastError: null | string;
    retryable: boolean;
    status: string;
    updatedAt: JsonDate;
  }[];
  invoices: {
    amountDue: number;
    amountPaid: number;
    billingReason: null | string;
    createdAt: JsonDate;
    currency: string;
    disputeStatus: null | string;
    externalId: string;
    id: number;
    paidAt: JsonDate | null;
    periodEnd: JsonDate | null;
    periodStart: JsonDate | null;
    refundedAmount: number;
    status: string;
  }[];
  offerRegistered: boolean;
  purchase: AdminPurchaseRow;
  subscription:
    | null
    | (Subscription & {
        externalId: string;
        lastError: null | string;
        providerStatus: string;
        syncedAt: JsonDate;
      });
}

const failed = (status: number, screen: string, params?: object) =>
  new AdminRequestError(
    status,
    screen,
    params ? describeAdminParams(params) : undefined,
  );

export const paymentsAdminRoot = adminQueryRoot("payments");

export const paymentsOverviewQueryOptions = () =>
  queryOptions({
    queryFn: async (): Promise<PaymentsOverview> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "admin/payments",
        path: "/overview",
      });
      if (!response.ok) throw failed(response.status, "the payments overview");

      return await response.json();
    },
    queryKey: [...paymentsAdminRoot, "overview"] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminPurchasesQueryOptions = ({
  params,
}: {
  params: PurchasesAdminParams;
}) =>
  queryOptions({
    queryFn: async (): Promise<AdminTablePage<AdminPurchaseRow>> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { query: params },
        method: "get",
        module: "admin/payments",
        path: "/purchases",
      });
      if (!response.ok)
        throw failed(response.status, "the purchases list", params);

      return await response.json();
    },
    queryKey: [...paymentsAdminRoot, "purchases", params] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminSubscriptionsQueryOptions = ({
  params,
}: {
  params: SubscriptionsAdminParams;
}) =>
  queryOptions({
    queryFn: async (): Promise<AdminTablePage<AdminSubscriptionRow>> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { query: params },
        method: "get",
        module: "admin/payments",
        path: "/subscriptions",
      });
      if (!response.ok) {
        throw failed(response.status, "the subscriptions list", params);
      }

      return await response.json();
    },
    queryKey: [...paymentsAdminRoot, "subscriptions", params] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminWebhookEventsQueryOptions = ({
  params,
}: {
  params: EventsAdminParams;
}) =>
  queryOptions({
    queryFn: async (): Promise<AdminTablePage<AdminWebhookEventRow>> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { query: params },
        method: "get",
        module: "admin/payments",
        path: "/events",
      });
      if (!response.ok)
        throw failed(response.status, "the webhook events", params);

      return await response.json();
    },
    queryKey: [...paymentsAdminRoot, "events", params] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminPurchaseQueryOptions = ({ id }: { id: string }) =>
  queryOptions({
    queryFn: async (): Promise<AdminPurchaseDetail> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { id } },
        method: "get",
        module: "admin/payments",
        path: "/purchases/{id}",
      });
      if (!response.ok) throw failed(response.status, "the purchase");

      return await response.json();
    },
    queryKey: [...paymentsAdminRoot, "purchase", id] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const retryFulfillmentRequest = async (id: number): Promise<void> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "post",
    module: "admin/payments",
    path: "/fulfillments/{id}/retry",
  });
  if (!response.ok) throw failed(response.status, "the fulfillment retry");
};

export const retryWebhookEventRequest = async (id: number): Promise<void> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "post",
    module: "admin/payments",
    path: "/events/{id}/retry",
  });
  if (!response.ok) throw failed(response.status, "the webhook event retry");
};
