import { legalLinksQueryOptions } from "@/views/legal/legal-query";

import type { AuthLoaderContext } from "./login-route";

import { loadAuthCard } from "./login-route";

export const REGISTER_NAMESPACES = [
  "core.global",
  "core.auth.sign_up",
  "core.auth.sso",
  "core.legal",
] as const;

/**
 * The deployment configuration `/register` needs, plus the effective legal
 * documents the form links and accepts. Its title is in `head`.
 */
export const loadRegisterRoute = async (
  context: AuthLoaderContext,
): Promise<void> => {
  await Promise.all([
    loadAuthCard(context),
    context.queryClient.query({
      ...legalLinksQueryOptions(context.locale),
      staleTime: "static",
    }),
  ]);
};
