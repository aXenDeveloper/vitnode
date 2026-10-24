import { useQuery } from "@tanstack/react-query";

import type { SSOConfirmEmailResult } from "../email/sso-email-mutations";
import type { SSOCallbackState } from "./use-sso-callback";

/**
 * Confirms the address behind an emailed SSO link, once, when the link opens,
 * and reads the answer as a callback screen state.
 */
export const useSSOEmailConfirm = ({
  onConfirm,
  onSignedIn,
  providerId,
  token,
}: {
  onConfirm: (token: string) => Promise<SSOConfirmEmailResult>;
  onSignedIn: () => void;
  providerId: string;
  token: string;
}): SSOCallbackState => {
  const { data, isError } = useQuery({
    queryFn: async () => {
      const result = await onConfirm(token);
      if (result.ok) onSignedIn();

      return result;
    },
    queryKey: ["core.auth.sso.email.confirm", providerId, token],
    retry: false,
    staleTime: Infinity,
  });

  if (isError) return { kind: "error" };
  if (!data || data.ok) return { kind: "pending" };
  if (data.failure === "link_required") {
    return { kind: "email_exists", offer: data.offer };
  }
  if (data.failure === "invalid_pending") {
    return { kind: "confirm_other_browser" };
  }
  if (data.failure === "invalid_link") return { kind: "confirm_invalid" };

  return { kind: "error" };
};
