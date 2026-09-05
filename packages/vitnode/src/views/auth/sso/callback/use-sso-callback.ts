"use client";

import { useQuery } from "@tanstack/react-query";

import type { SSOCallbackResult } from "./sso-callback-result";

/** What the callback screen is showing right now. */
export type SSOCallbackState =
  "access_denied" | "email_exists" | "error" | "pending";

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
