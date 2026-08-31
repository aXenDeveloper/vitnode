"use client";

import { useQuery } from "@tanstack/react-query";

import type { SSOCallbackResult } from "./sso-callback-result";

/** What the callback screen is showing right now. */
export type SSOCallbackState =
  "access_denied" | "email_exists" | "error" | "pending";

/**
 * The exchange, run once, with the framework parts held at arm's length.
 *
 * Two callbacks and no imports beyond Query, which is framework-free and
 * already mounted in both apps:
 *
 * - `onCallback` sends the code and the state to the API and answers what
 *   happened. Next.js calls a server action; TanStack Start calls the API.
 * - `onSignedIn` runs once that succeeded. Both frameworks send the visitor to
 *   the front page, by their own means.
 *
 * `retry: false` because an authorization code is single-use: a second attempt
 * cannot succeed, and would turn a clear "that email is taken" into a generic
 * failure. The query key carries the provider and the code, so a re-render
 * never re-runs the exchange and a genuinely new callback always does.
 *
 * A provider that reported `access_denied` in the URL never gets that far -
 * there is no code to exchange, so the query does not run at all.
 */
export const useSSOCallback = ({
  code,
  oauthError,
  onCallback,
  onSignedIn,
  providerId,
}: {
  code: string;
  /** The `error` parameter the provider redirected back with, if any. */
  oauthError?: string;
  onCallback: () => Promise<SSOCallbackResult>;
  onSignedIn: () => void;
  providerId: string;
}): SSOCallbackState => {
  const denied = oauthError === "access_denied";
  const { error, isError } = useQuery({
    enabled: !denied,
    queryFn: async () => {
      const result = await onCallback();
      if (result?.failure) {
        throw new Error(result.failure);
      }
      onSignedIn();

      return "";
    },
    queryKey: ["core.auth.sso.callback.sign-up", providerId, code],
    retry: false,
  });

  if (denied) return "access_denied";
  if (error?.message === "email_exists") return "email_exists";
  if (isError) return "error";

  return "pending";
};
