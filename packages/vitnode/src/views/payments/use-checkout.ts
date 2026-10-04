import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { BillingInterval } from "@/payments/status";

import type { PurchaseState } from "./payments-query";

import {
  cancelPurchaseRequest,
  invalidateBilling,
  isPaymentsRequestError,
  openBillingPortalRequest,
  startCheckoutRequest,
} from "./payments-query";

export interface CheckoutChoice {
  currency: string;
  interval: BillingInterval | null;
  offerId: string;
  pluginId: string;
}

/** Errors after which repeating the same request is the right thing to do. */
const isUncertain = (error: unknown): boolean =>
  !isPaymentsRequestError(error) || error.code === "checkout_uncertain";

/**
 * Starts a hosted checkout and sends the browser there.
 *
 * The idempotency key is per choice, and kept only while the last answer was
 * "we do not know": retrying after a timeout gets the same checkout back,
 * while a deliberate second attempt after a real answer starts fresh. The
 * server also deduplicates double clicks on its own, so this is the second
 * line of defence, not the only one.
 */
export const useStartCheckout = ({
  onRedirect = url => {
    window.location.assign(url);
  },
  userId,
}: {
  onRedirect?: (url: string) => void;
  userId: null | number;
}) => {
  const queryClient = useQueryClient();
  const keyRef = React.useRef<null | { choice: string; value: string }>(null);

  return useMutation({
    mutationFn: async (choice: CheckoutChoice): Promise<PurchaseState> => {
      const signature = JSON.stringify(choice);
      if (keyRef.current?.choice !== signature) {
        keyRef.current = { choice: signature, value: crypto.randomUUID() };
      }

      try {
        const result = await startCheckoutRequest({
          ...choice,
          idempotencyKey: keyRef.current.value,
        });
        keyRef.current = null;

        return result;
      } catch (error) {
        if (!isUncertain(error)) keyRef.current = null;
        throw error;
      }
    },
    onSettled: async () => {
      await invalidateBilling(queryClient, userId);
    },
    onSuccess: result => {
      if (result.checkoutUrl) onRedirect(result.checkoutUrl);
    },
  });
};

export const useCancelPurchase = ({ userId }: { userId: null | number }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelPurchaseRequest,
    onSettled: async () => {
      await invalidateBilling(queryClient, userId);
    },
  });
};

/** Opens the provider's billing portal for the signed-in user. */
export const useBillingPortal = ({
  onRedirect = url => {
    window.location.assign(url);
  },
}: { onRedirect?: (url: string) => void } = {}) =>
  useMutation({
    mutationFn: openBillingPortalRequest,
    onSuccess: url => {
      onRedirect(url);
    },
  });
