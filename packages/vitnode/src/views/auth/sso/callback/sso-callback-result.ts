/**
 * What came back from exchanging an OAuth code for a session, as the callback
 * screen cares about it.
 *
 * Two failures and nothing else: an email that already belongs to another
 * account, which the visitor can act on, and everything else, which they
 * cannot. Kept as codes rather than as the sentences they used to be - the
 * screen compared `error.message === "Email already exists"`, so an edit to
 * that string in one file silently changed which screen the other one rendered.
 */
export type SSOCallbackFailure = "email_exists" | "unknown";

export type SSOCallbackResult = undefined | { failure?: SSOCallbackFailure };

/**
 * The API's status code, read as an outcome.
 *
 * Pure, so the mapping is checkable without a request: 200 signed the visitor
 * in, 409 is the email conflict, and anything else is a failure they cannot
 * resolve.
 */
export const ssoCallbackResultFromStatus = (
  status: number,
): SSOCallbackResult => {
  if (status === 200) return {};
  if (status === 409) return { failure: "email_exists" };

  return { failure: "unknown" };
};
