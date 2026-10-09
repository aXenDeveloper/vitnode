import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import { loadMiddlewareConfig } from "./middleware-config";
import {
  emailVerificationAvailability,
  EmailVerificationUnknownError,
} from "./verify-email";

export const loadVerifyEmailRoute = async ({
  queryClient,
}: {
  queryClient: QueryClient;
}): Promise<void> => {
  const availability = emailVerificationAvailability(
    await loadMiddlewareConfig(queryClient),
  );

  if (availability === "unknown") throw new EmailVerificationUnknownError();

  // oxlint-disable-next-line typescript/only-throw-error
  if (availability === "disabled") throw notFound();
};
