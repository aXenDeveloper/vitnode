import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";

import type { SSOLinkOffer } from "../link/schema";

const CREDENTIALS = { credentials: "include" } as const;

export type SSOEmailCodeFailure =
  | "invalid_pending"
  | "server_error"
  | "too_many_codes";

export type SSOSendEmailCodeResult =
  | { failure: SSOEmailCodeFailure; ok: false }
  | { ok: true };

export type SSOVerifyEmailCodeResult =
  | { failure: "link_required"; offer: SSOLinkOffer; ok: false }
  | {
      failure:
        | "code_expired"
        | "invalid_code"
        | "invalid_pending"
        | "server_error";
      ok: false;
    }
  | { ok: true };

const errorOf = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();

    return typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
      ? body.error
      : undefined;
  } catch {
    return undefined;
  }
};

/** Asks the API to email a code to `email` for this browser's pending sign-in. Browser-only. */
export const sendSsoEmailCodeInBrowser = async ({
  email,
  providerId,
}: {
  email: string;
  providerId: string;
}): Promise<SSOSendEmailCodeResult> => {
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

    const error = await errorOf(response);
    if (error === "invalid_pending" || error === "too_many_codes") {
      return { failure: error, ok: false };
    }

    return { failure: "server_error", ok: false };
  } catch {
    return { failure: "server_error", ok: false };
  }
};

/** Confirms the emailed code; signs in, or hands back the link offer. Browser-only. */
export const verifySsoEmailCodeInBrowser = async ({
  code,
  providerId,
}: {
  code: string;
  providerId: string;
}): Promise<SSOVerifyEmailCodeResult> => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      args: { body: { code }, params: { providerId } },
      method: "post",
      module: "users/sso",
      options: CREDENTIALS,
      path: "/pending/{providerId}/verify",
    });

    if (response.status === 200) return { ok: true };
    if (response.status === 409) {
      const body = await response.json();
      if ("linkToken" in body) {
        return { failure: "link_required", offer: body, ok: false };
      }
    }

    const error = await errorOf(response);
    if (
      error === "code_expired" ||
      error === "invalid_code" ||
      error === "invalid_pending"
    ) {
      return { failure: error, ok: false };
    }

    return { failure: "server_error", ok: false };
  } catch {
    return { failure: "server_error", ok: false };
  }
};
