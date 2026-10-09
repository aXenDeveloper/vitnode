import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import { loadMiddlewareConfig } from "./middleware-config";
import {
  emailVerificationAvailability,
  EmailVerificationUnknownError,
} from "./verify-email";

/**
 * Warms the deployment configuration - the resend form needs its captcha - and
 * answers "not found" on an install that cannot send email, where there is
 * nothing to confirm.
 *
 * The strings are not fetched here: the route declares
 * `VERIFY_EMAIL_NAMESPACES` in `messages`, so the runtime warms them first.
 */
export const loadVerifyEmailRoute = async ({
  queryClient,
}: {
  queryClient: QueryClient;
}): Promise<void> => {
  const availability = emailVerificationAvailability(
    await loadMiddlewareConfig(queryClient),
  );

  // Not a 404: the route exists, the API could not say whether the flow does.
  if (availability === "unknown") throw new EmailVerificationUnknownError();

  // TanStack Router's own control-flow signal, like `redirect()`.
  // oxlint-disable-next-line typescript/only-throw-error
  if (availability === "disabled") throw notFound();
};
