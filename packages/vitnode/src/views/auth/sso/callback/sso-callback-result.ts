export type SSOCallbackFailure = "email_exists" | "unknown";

export type SSOCallbackResult = undefined | { failure?: SSOCallbackFailure };

export const ssoCallbackResultFromStatus = (
  status: number,
): SSOCallbackResult => {
  if (status === 200) return {};
  if (status === 409) return { failure: "email_exists" };

  return { failure: "unknown" };
};
