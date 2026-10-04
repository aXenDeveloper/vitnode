import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { isPurchaseSettled } from "@/payments/status";

import { fetchPurchase, paymentsUserRoot } from "./payments-query";

/** Checks before giving up on automatic updates - about a minute in total. */
export const PURCHASE_RETURN_MAX_CHECKS = 8;

/** 1s, 2s, 4s, 8s, then every 15s: fast while it is likely, gentle after. */
export const purchaseReturnDelay = (checksSoFar: number): number =>
  Math.min(1000 * 2 ** Math.max(0, checksSoFar - 1), 15_000);

/**
 * Follows a purchase after the buyer comes back from the hosted checkout.
 *
 * The redirect proves nothing, so every check asks the server, which asks the
 * provider. Polling backs off, stops on a settled state, stops after
 * {@link PURCHASE_RETURN_MAX_CHECKS} and stops when the component unmounts -
 * `check()` lets the buyer ask again by hand after that.
 */
export const usePurchaseReturn = ({
  fetchState = fetchPurchase,
  onSettled,
  purchaseId,
  userId,
}: {
  /** How one check is made. Defaults to the API; a test hands in its own. */
  fetchState?: typeof fetchPurchase;
  onSettled?: () => Promise<void> | void;
  purchaseId: null | string;
  userId: null | number;
}) => {
  const queryClient = useQueryClient();
  const queryKey = [
    ...paymentsUserRoot(userId),
    "purchase",
    purchaseId,
  ] as const;
  const query = useQuery({
    enabled: !!purchaseId && userId !== null,
    queryFn: async () => await fetchState(purchaseId ?? "", { refresh: true }),
    queryKey,
    refetchInterval: ({ state }) => {
      const purchase = state.data?.purchase;
      if (!purchase || isPurchaseSettled(purchase)) return false;
      if (state.dataUpdateCount >= PURCHASE_RETURN_MAX_CHECKS) return false;

      return purchaseReturnDelay(state.dataUpdateCount);
    },
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });

  const purchase = query.data?.purchase ?? null;
  const checks = queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0;
  const settled = purchase ? isPurchaseSettled(purchase) : false;
  const settledRef = React.useRef(false);

  React.useEffect(() => {
    if (!settled || settledRef.current) return;
    settledRef.current = true;
    void (async () => {
      // The lists only - invalidating this query too would check once more for
      // a purchase that is already settled.
      await Promise.all(
        (["purchases", "subscriptions"] as const).map(
          async list =>
            await queryClient.invalidateQueries({
              queryKey: [...paymentsUserRoot(userId), list],
            }),
        ),
      );
      await onSettled?.();
    })();
  }, [onSettled, queryClient, settled, userId]);

  return {
    check: async () => {
      await query.refetch();
    },
    error: query.error,
    isChecking: query.isFetching,
    purchase,
    settled,
    /** Still unsettled after every automatic check - offer a manual one. */
    slow: !!purchase && !settled && checks >= PURCHASE_RETURN_MAX_CHECKS,
  };
};
