import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

export type CheckoutError =
  | "already_owned"
  | "payment_in_progress"
  | "payment_processing"
  | "provider_not_found"
  | "provider_rejected"
  | "provider_unavailable"
  | "unauthorized"
  | "unknown";

const KNOWN_ERRORS = new Set<string>([
  "already_owned",
  "payment_in_progress",
  "payment_processing",
  "provider_not_found",
  "provider_rejected",
  "provider_unavailable",
]);

/**
 * Asks the server for a checkout and returns where to send the browser. Only
 * the item and the provider leave the browser; the price is the server's.
 */
export const startCheckout = async ({
  itemId,
  providerId,
}: {
  itemId: "sticker-pack";
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

  return {
    error: KNOWN_ERRORS.has(code) ? (code as CheckoutError) : "unknown",
  };
};
