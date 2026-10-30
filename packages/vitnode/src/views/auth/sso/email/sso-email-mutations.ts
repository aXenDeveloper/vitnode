import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";

import type { SSOLinkOffer } from "../link/schema";

import { errorCodeOf } from "../error-code-of";

const CREDENTIALS = { credentials: "include" } as const;

export type SSOSendEmailLinkResult =
  | {
      failure: "invalid_pending" | "server_error" | "too_many_emails";
      ok: false;
    }
  | { ok: true };

export type SSOConfirmEmailResult =
  | { failure: "invalid_link" | "invalid_pending" | "server_error"; ok: false }
  | { failure: "link_required"; offer: SSOLinkOffer; ok: false }
  | { ok: true };

/** Asks the API to email a confirmation link to `email` for this browser's pending sign-in. Browser-only. */
export const sendSsoEmailLinkInBrowser = async ({
  email,
  providerId,
}: {
  email: string;
  providerId: string;
}): Promise<SSOSendEmailLinkResult> => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      args: { body: { email }, params: { providerId } },
      method: "post",
      module: "users/sso",
      options: CREDENTIALS,
      path: "/pending/{providerId}/email",
    });

    if (response.status === 201) return { ok: true };

    const error = await errorCodeOf(response);
    if (error === "invalid_pending" || error === "too_many_emails") {
      return { failure: error, ok: false };
    }

    return { failure: "server_error", ok: false };
  } catch {
    return { failure: "server_error", ok: false };
  }
};

/** Confirms the address with the token from the emailed link; signs in, or hands back the link offer. Browser-only. */
export const confirmSsoEmailInBrowser = async ({
  providerId,
  token,
}: {
  providerId: string;
  token: string;
}): Promise<SSOConfirmEmailResult> => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      args: { body: { token }, params: { providerId } },
      method: "post",
      module: "users/sso",
      options: CREDENTIALS,
      path: "/pending/{providerId}/confirm",
    });

    if (response.status === 200) return { ok: true };
    if (response.status === 409) {
      const body = await response.json();
      if ("linkToken" in body) {
        return { failure: "link_required", offer: body, ok: false };
      }
    }

    const error = await errorCodeOf(response);
    if (error === "invalid_link" || error === "invalid_pending") {
      return { failure: error, ok: false };
    }

    return { failure: "server_error", ok: false };
  } catch {
    return { failure: "server_error", ok: false };
  }
};
