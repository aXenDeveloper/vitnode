import type { SSOLinkOffer } from "../link/schema";

export type SSOCallbackFailure = "email_exists" | "unknown";

export type SSOCallbackResult =
  | undefined
  | { failure?: SSOCallbackFailure; offer?: SSOLinkOffer };

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
