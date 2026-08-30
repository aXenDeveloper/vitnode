import type { AuthLoaderContext, AuthRouteData } from "./login-route";

import { loadAuthCard } from "./login-route";

/**
 * What the registration page renders strings from.
 *
 * `core.global` is the heading's and the error toasts', `core.auth.sign_up` is
 * the form's, `core.auth.sso` is the provider row's - the same three the Next.js
 * view declares. One list, read by both the loader that fetches them and the
 * provider that mounts them, because they have to be the same set or the
 * provider suspends on a key nobody warmed.
 */
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
