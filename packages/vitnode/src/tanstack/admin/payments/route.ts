import { notFound } from "@tanstack/react-router";

import type { PluginRouteTranslator } from "@/routing";
import type {
  EventsAdminParams,
  PurchasesAdminParams,
  SubscriptionsAdminParams,
} from "@/views/admin/views/core/payments/payments-admin-query";

import {
  adminPurchaseQueryOptions,
  adminPurchasesQueryOptions,
  adminSubscriptionsQueryOptions,
  adminWebhookEventsQueryOptions,
  paymentsOverviewQueryOptions,
} from "@/views/admin/views/core/payments/payments-admin-query";
import { paymentsSettingsQueryOptions } from "@/views/payments/payments-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";
import { hasAdminPermission } from "../state";

/** Every payments screen renders amounts and states from both trees. */
export const ADMIN_PAYMENTS_NAMESPACES = [
  "admin.payments",
  "core.global",
  "core.payments",
] as const;

const VIEW = { module: "payments", permission: "can_view" } as const;
const RETRY = { module: "payments", permission: "can_retry" } as const;

interface ScreenData {
  canRetry: boolean;
  description: string;
  title: string;
}

export interface AdminPaymentsRouteData extends ScreenData {
  params: PurchasesAdminParams;
}

export interface AdminSubscriptionsRouteData extends ScreenData {
  params: SubscriptionsAdminParams;
}

export interface AdminWebhookEventsRouteData extends ScreenData {
  params: EventsAdminParams;
}

export interface AdminPaymentRouteData extends ScreenData {
  id: string;
}

type Loader<TParams> = AdminScreenContext & {
  params: TParams;
  t: PluginRouteTranslator;
};

const warmShared = async ({ queryClient }: AdminScreenContext) => {
  await Promise.all([
    queryClient.query({
      ...paymentsOverviewQueryOptions(),
      staleTime: "static",
    }),
    queryClient.query({
      ...paymentsSettingsQueryOptions(),
      staleTime: "static",
    }),
  ]);
};

export const loadAdminPaymentsRoute = async (
  context: Loader<PurchasesAdminParams>,
): Promise<AdminPaymentsRouteData> => {
  requireAdminPermission(context.adminAccess, VIEW);

  await Promise.all([
    warmShared(context),
    context.queryClient.query({
      ...adminPurchasesQueryOptions({ params: context.params }),
      staleTime: "static",
    }),
  ]);

  return {
    canRetry: hasAdminPermission(context.adminAccess, RETRY),
    description: context.t("admin.payments.desc"),
    params: context.params,
    title: context.t("admin.payments.title"),
  };
};

export const loadAdminSubscriptionsRoute = async (
  context: Loader<SubscriptionsAdminParams>,
): Promise<AdminSubscriptionsRouteData> => {
  requireAdminPermission(context.adminAccess, VIEW);

  await Promise.all([
    warmShared(context),
    context.queryClient.query({
      ...adminSubscriptionsQueryOptions({ params: context.params }),
      staleTime: "static",
    }),
  ]);

  return {
    canRetry: hasAdminPermission(context.adminAccess, RETRY),
    description: context.t("admin.payments.subscriptions.desc"),
    params: context.params,
    title: context.t("admin.payments.subscriptions.title"),
  };
};

export const loadAdminWebhookEventsRoute = async (
  context: Loader<EventsAdminParams>,
): Promise<AdminWebhookEventsRouteData> => {
  requireAdminPermission(context.adminAccess, VIEW);

  await context.queryClient.query({
    ...adminWebhookEventsQueryOptions({ params: context.params }),
    staleTime: "static",
  });

  return {
    canRetry: hasAdminPermission(context.adminAccess, RETRY),
    description: context.t("admin.payments.events.desc"),
    params: context.params,
    title: context.t("admin.payments.events.title"),
  };
};

export const loadAdminPaymentRoute = async (
  context: Loader<{ id: string }>,
): Promise<AdminPaymentRouteData> => {
  requireAdminPermission(context.adminAccess, VIEW);

  const { id } = context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    // TanStack Router's own control-flow signal.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  const [detail] = await Promise.all([
    context.queryClient.query({
      ...adminPurchaseQueryOptions({ id }),
      staleTime: "static",
    }),
    context.queryClient.query({
      ...paymentsSettingsQueryOptions(),
      staleTime: "static",
    }),
  ]);

  return {
    canRetry: hasAdminPermission(context.adminAccess, RETRY),
    description: detail.purchase.pluginId,
    id,
    title: `${detail.purchase.offerName} - ${context.t("admin.payments.detail.title")}`,
  };
};
