import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

export const catalogQueryOptions = () =>
  queryOptions({
    queryKey: [manifest.id, "catalog"],
    queryFn: async () => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "purchases",
        path: "/catalog",
      });
      if (res.status !== 200) {
        throw new Error(`Loading the catalog answered ${res.status}.`);
      }

      return await res.json();
    },
  });

export const myPurchasesQueryOptions = () =>
  queryOptions({
    queryKey: [manifest.id, "purchases"],
    queryFn: async () => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "purchases",
        path: "/",
      });
      if (res.status !== 200) {
        throw new Error(`Loading purchases answered ${res.status}.`);
      }

      return await res.json();
    },
  });

const isWaiting = (status: string | undefined) =>
  status === "pending" || status === "processing";

/**
 * One purchase. While its payment is open the query polls every 5 seconds:
 * the server confirms the payment, never the redirect back from checkout.
 */
export const purchaseQueryOptions = (purchaseId: number) =>
  queryOptions({
    queryKey: [manifest.id, "purchases", purchaseId],
    queryFn: async () => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "purchases",
        path: "/{purchaseId}",
        args: { params: { purchaseId } },
      });
      if (res.status === 404) return null;
      if (res.status !== 200) {
        throw new Error(`Loading the purchase answered ${res.status}.`);
      }

      return await res.json();
    },
    placeholderData: keepPreviousData,
    refetchInterval: query =>
      !query.state.data?.paid && isWaiting(query.state.data?.payment?.status)
        ? 5000
        : false,
  });

/**
 * Formats an integer amount in minor units without floating-point math: the
 * decimal point is placed by string, using the currency's own digits.
 */
export const formatMinorUnits = (
  amount: number,
  currency: string,
  locale: string,
): string => {
  const format = new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    style: "currency",
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  const raw = String(amount).padStart(digits + 1, "0");
  const decimal =
    digits === 0 ? raw : `${raw.slice(0, -digits)}.${raw.slice(-digits)}`;

  // `format` takes decimal strings exactly (Intl.NumberFormat v3).
  return format.format(decimal as `${number}`);
};
