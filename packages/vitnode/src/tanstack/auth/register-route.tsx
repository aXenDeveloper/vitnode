import type { AuthLoaderContext } from "./login-route";

import { loadAuthCard } from "./login-route";

export const REGISTER_NAMESPACES = [
  "core.global",
  "core.auth.sign_up",
  "core.auth.sso",
] as const;

/** The deployment configuration `/register` needs. Its title is in `head`. */
export const loadRegisterRoute = async (
  context: AuthLoaderContext,
): Promise<void> => {
  await loadAuthCard(context);
};
