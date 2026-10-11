import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import type { PaymentsSettings } from "@/views/payments/payments-query";

import { paymentsSettingsQueryOptions } from "@/views/payments/payments-query";

/**
 * Loads the public payments settings, or answers 404 when no provider is
 * configured - every payments screen is hidden then, not shown empty.
 */
export const requirePaymentsEnabled = async (
  queryClient: QueryClient,
): Promise<PaymentsSettings> => {
  const settings = await queryClient.query({
    ...paymentsSettingsQueryOptions(),
    staleTime: "static",
  });

  // oxlint-disable-next-line typescript/only-throw-error
  if (!settings.enabled) throw notFound();

  return settings;
};
