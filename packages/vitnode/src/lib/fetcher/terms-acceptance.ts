import { isTermsAcceptanceRequiredError } from "@vitnode/api/lib/legal/contract";

/**
 * Window event dispatched when the API answers `403 TERMS_ACCEPTANCE_REQUIRED`:
 * the signed-in member owes acceptance of the effective Terms of Service. The
 * legal state sync refetches the session, and the gate opens the acceptance
 * page.
 */
export const TERMS_ACCEPTANCE_REQUIRED_EVENT =
  "vitnode:terms-acceptance-required";

/**
 * Reads a `403` body (from a clone, so the caller can still read it) and
 * dispatches {@link TERMS_ACCEPTANCE_REQUIRED_EVENT} when it is the typed
 * acceptance error. No-op on the server and for every other response.
 * Browser-only; never awaits the caller.
 */
export const notifyTermsAcceptanceRequired = (response: Response): void => {
  if (typeof window === "undefined" || response.status !== 403) return;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return;
  }

  void response
    .clone()
    .json()
    .then((body: unknown) => {
      if (isTermsAcceptanceRequiredError(body)) {
        window.dispatchEvent(new CustomEvent(TERMS_ACCEPTANCE_REQUIRED_EVENT));
      }
    })
    .catch(() => undefined);
};
