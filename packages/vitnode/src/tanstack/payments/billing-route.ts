import type { QueryClient } from "@tanstack/react-query";

import {
  purchasesQueryOptions,
  subscriptionsQueryOptions,
} from "@/views/payments/payments-query";

import { requirePaymentsEnabled } from "./require-enabled";

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
  await requirePaymentsEnabled(queryClient);

  await Promise.all([
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
