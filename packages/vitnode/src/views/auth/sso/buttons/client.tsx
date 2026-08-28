"use client";

import type { SSOProvider } from "../providers";

import { mutationApi } from "./mutation-api.server";
import { SSOButtonsContent } from "./sso-buttons-content";

/**
 * {@link SSOButtonsContent}, wired to Next.js.
 *
 * One prop wide, and that prop is the whole of the boundary: a server action
 * that asks the API for the provider's authorization URL and redirects to it.
 * Redirecting *is* the success path, so it never returns - a message coming
 * back means the flow could not be started, and the shared row raises the
 * internal-error toast.
 */
export const SSOButtonsClient = ({
  providers,
}: {
  providers: readonly SSOProvider[];
}) => (
  <SSOButtonsContent onSelectProvider={mutationApi} providers={providers} />
);
