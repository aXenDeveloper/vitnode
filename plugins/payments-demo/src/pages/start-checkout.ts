import { fetcher } from "@vitnode/core/tanstack/fetcher";

import type { DemoItemId } from "@/catalog";

import { manifest } from "@/manifest.gen";

const SERVER_ERRORS = [
  "already_owned",
  "payment_in_progress",
  "payment_processing",
  "provider_not_found",
  "provider_rejected",
  "provider_unavailable",
] as const;

type ServerError = (typeof SERVER_ERRORS)[number];

export type CheckoutError = "unauthorized" | "unknown" | ServerError;

const isServerError = (code: string): code is ServerError =>
  (SERVER_ERRORS as readonly string[]).includes(code);

/**
 * Asks the server for a checkout and returns where to send the browser. Only
 * the item and the provider leave the browser; the price is the server's.
 */
export const startCheckout = async ({
  itemId,
  providerId,
}: {
  itemId: DemoItemId;
  providerId: string;
}): Promise<{ error: CheckoutError } | { redirectUrl: string }> => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "post",
    module: "purchases",
    path: "/checkout",
    args: { body: { itemId, providerId } },
  });

  if (res.status === 200) {
    const { redirectUrl } = await res.json();

    return { redirectUrl };
  }
  if (res.status === 401) return { error: "unauthorized" };

  const body: unknown = await res.json().catch(() => null);
  const code =
    typeof body === "object" && body !== null && "error" in body
      ? String(body.error)
      : "";

  return { error: isServerError(code) ? code : "unknown" };
};
