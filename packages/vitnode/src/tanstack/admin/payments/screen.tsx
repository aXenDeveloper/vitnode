import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { PageTitle } from "@/components/ui/page-title";
import { EventsTableContent } from "@/views/admin/views/core/payments/events-table-content";
import { PaymentsOverviewContent } from "@/views/admin/views/core/payments/overview-content";
import {
  adminPurchaseQueryOptions,
  adminPurchasesQueryOptions,
  adminSubscriptionsQueryOptions,
  adminWebhookEventsQueryOptions,
  paymentsOverviewQueryOptions,
} from "@/views/admin/views/core/payments/payments-admin-query";
import { PurchaseDetailContent } from "@/views/admin/views/core/payments/purchase-detail-content";
import { PurchasesTableContent } from "@/views/admin/views/core/payments/purchases-table-content";
import { SubscriptionsTableContent } from "@/views/admin/views/core/payments/subscriptions-table-content";
import { paymentsSettingsQueryOptions } from "@/views/payments/payments-query";

import type {
  AdminTableNavigate,
  AdminTableRouteSearch,
} from "../table-search";
import type {
  AdminPaymentRouteData,
  AdminPaymentsRouteData,
  AdminSubscriptionsRouteData,
  AdminWebhookEventsRouteData,
} from "./route";
import type { PaymentsTableRouteSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_PAYMENTS_NAMESPACES } from "./route";
import {
  eventsSearchFrom,
  eventsSearchParams,
  purchasesSearch,
  subscriptionsSearch,
} from "./route-search";

type Search = Record<string, unknown>;

const useTableNavigation = <TSearch,>(
  navigate: AdminTableNavigate<TSearch>,
  search: Search,
  {
    from,
    searchParams,
  }: {
    from: (next: string) => TSearch;
    searchParams: (input: Search) => URLSearchParams;
  },
) =>
  React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({ resetScroll: false, search: from(nextSearch) });
      },
      searchParams: searchParams(search),
    }),
    [from, navigate, search, searchParams],
  );

/** The filter options: enabled currencies, plus any that history still holds. */
const useFilterOptions = () => {
  const { data: overview } = useSuspenseQuery(paymentsOverviewQueryOptions());
  const { data: settings } = useSuspenseQuery(paymentsSettingsQueryOptions());

  return {
    currencies: [
      ...new Set([
        ...settings.currencies.map(currency => currency.code),
        ...overview.totals.map(total => total.currency),
      ]),
    ].sort(),
    overview,
    providers: overview.providers.map(provider => provider.id),
  };
};

const Frame = ({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) => (
  <RouteMessages namespaces={ADMIN_PAYMENTS_NAMESPACES}>
    <div className="flex flex-col gap-6 p-6">
      <PageTitle className="mb-0" desc={description} h1={title} />
      {children}
    </div>
  </RouteMessages>
);

export const AdminPaymentsRouteContent = ({
  description,
  navigate,
  params,
  search,
  title,
}: AdminPaymentsRouteData & {
  navigate: AdminTableNavigate<PaymentsTableRouteSearch>;
  search: Search;
}) => {
  const { currencies, overview, providers } = useFilterOptions();
  const { data } = useSuspenseQuery(adminPurchasesQueryOptions({ params }));
  const navigation = useTableNavigation(navigate, search, purchasesSearch);

  return (
    <Frame description={description} title={title}>
      <PaymentsOverviewContent data={overview} />
      <DataTableNavigationProvider value={navigation}>
        <PurchasesTableContent
          currencies={currencies}
          data={data}
          providers={providers}
        />
      </DataTableNavigationProvider>
    </Frame>
  );
};

export const AdminSubscriptionsRouteContent = ({
  description,
  navigate,
  params,
  search,
  title,
}: AdminSubscriptionsRouteData & {
  navigate: AdminTableNavigate<PaymentsTableRouteSearch>;
  search: Search;
}) => {
  const { currencies, providers } = useFilterOptions();
  const { data } = useSuspenseQuery(adminSubscriptionsQueryOptions({ params }));
  const navigation = useTableNavigation(navigate, search, subscriptionsSearch);

  return (
    <Frame description={description} title={title}>
      <DataTableNavigationProvider value={navigation}>
        <SubscriptionsTableContent
          currencies={currencies}
          data={data}
          providers={providers}
        />
      </DataTableNavigationProvider>
    </Frame>
  );
};

const EVENTS_SEARCH = {
  from: eventsSearchFrom,
  searchParams: eventsSearchParams,
};

export const AdminWebhookEventsRouteContent = ({
  canRetry,
  description,
  navigate,
  params,
  search,
  title,
}: AdminWebhookEventsRouteData & {
  navigate: AdminTableNavigate<AdminTableRouteSearch>;
  search: Search;
}) => {
  const { data } = useSuspenseQuery(adminWebhookEventsQueryOptions({ params }));
  const navigation = useTableNavigation(navigate, search, EVENTS_SEARCH);

  return (
    <Frame description={description} title={title}>
      <DataTableNavigationProvider value={navigation}>
        <EventsTableContent canRetry={canRetry} data={data} />
      </DataTableNavigationProvider>
    </Frame>
  );
};

export const AdminPaymentRouteContent = ({
  canRetry,
  description,
  id,
  title,
}: AdminPaymentRouteData) => {
  const { data } = useSuspenseQuery(adminPurchaseQueryOptions({ id }));

  return (
    <Frame description={description} title={title}>
      <PurchaseDetailContent canRetry={canRetry} data={data} />
    </Frame>
  );
};
