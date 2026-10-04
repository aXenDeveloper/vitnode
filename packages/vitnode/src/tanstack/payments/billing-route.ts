import type { QueryClient } from "@tanstack/react-query";

import {
  paymentsSettingsQueryOptions,
  purchasesQueryOptions,
  subscriptionsQueryOptions,
} from "@/views/payments/payments-query";

/** Translation namespaces the billing screen renders from. */
export const BILLING_NAMESPACES = ["core.payments"] as const;

/** Warms everything `/settings/billing` shows, so it renders without a spinner. */
export const loadBillingRoute = async ({
  queryClient,
  userId,
}: {
  queryClient: QueryClient;
  userId: number;
}): Promise<{ userId: number }> => {
  await Promise.all([
    queryClient.query({
      ...paymentsSettingsQueryOptions(),
      staleTime: "static",
    }),
    queryClient.infiniteQuery({
      ...purchasesQueryOptions({ userId }),
      staleTime: "static",
    }),
    queryClient.infiniteQuery({
      ...subscriptionsQueryOptions({ userId }),
      staleTime: "static",
    }),
  ]);

  return { userId };
};
