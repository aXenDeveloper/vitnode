import type { AuthLoaderContext, AuthRouteData } from "./login-route";

import { loadAuthCard } from "./login-route";

export const REGISTER_NAMESPACES = [
  "core.global",
  "core.auth.sign_up",
  "core.auth.sso",
] as const;

/** The strings and the deployment configuration `/register` needs. */
export const loadRegisterRoute = async (
  context: AuthLoaderContext,
): Promise<AuthRouteData> =>
  await loadAuthCard(context, REGISTER_NAMESPACES, "register");
