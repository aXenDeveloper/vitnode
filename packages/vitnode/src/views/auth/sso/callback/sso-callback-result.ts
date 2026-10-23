import type { SSOLinkOffer } from "../link/schema";

export type SSOCallbackFailure =
  | "email_exists"
  | "email_required"
  | "email_unavailable"
  | "unknown";

export type SSOCallbackResult =
  | undefined
  | {
      /** The provider's unverified address, offered as a starting point when `failure` is `email_required`. */
      emailSuggestion?: null | string;
      failure?: SSOCallbackFailure;
      offer?: SSOLinkOffer;
    };

export const ssoCallbackResultFromStatus = (
  status: number,
  offer?: SSOLinkOffer,
): SSOCallbackResult => {
  if (status === 200) return {};
  if (status === 409) {
    return offer
      ? { failure: "email_exists", offer }
      : { failure: "email_exists" };
  }

  return { failure: "unknown" };
};
