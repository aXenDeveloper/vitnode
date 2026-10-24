import { useQuery } from "@tanstack/react-query";

import type { SSOLinkOffer } from "../link/schema";
import type { SSOCallbackResult } from "./sso-callback-result";

export type SSOCallbackState =
  | { emailSuggestion: null | string; kind: "email_required" }
  | { kind: "email_exists"; offer: null | SSOLinkOffer }
  | {
      kind:
        | "access_denied"
        | "confirm_invalid"
        | "confirm_other_browser"
        | "email_unavailable"
        | "error"
        | "pending";
    };

export const useSSOCallback = ({
  code,
  oauthError,
  onCallback,
  onSignedIn,
  providerId,
}: {
  code: string;
  oauthError?: string;
  onCallback: () => Promise<SSOCallbackResult>;
  onSignedIn: () => void;
  providerId: string;
}): SSOCallbackState => {
  const denied = oauthError === "access_denied";
  const { data, isError } = useQuery({
    enabled: !denied,
    queryFn: async (): Promise<Exclude<SSOCallbackResult, undefined>> => {
      const result = (await onCallback()) ?? {};

      if (!result.failure) onSignedIn();

      return result;
    },
    queryKey: ["core.auth.sso.callback.sign-up", providerId, code],
    retry: false,
  });

  if (denied) return { kind: "access_denied" };
  if (isError) return { kind: "error" };
  if (data?.failure === "email_exists") {
    return { kind: "email_exists", offer: data.offer ?? null };
  }
  if (data?.failure === "email_required") {
    return {
      emailSuggestion: data.emailSuggestion ?? null,
      kind: "email_required",
    };
  }
  if (data?.failure === "email_unavailable") {
    return { kind: "email_unavailable" };
  }
  if (data?.failure) return { kind: "error" };

  return { kind: "pending" };
};
