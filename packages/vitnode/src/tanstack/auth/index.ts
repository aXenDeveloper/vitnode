/**
 * VitNode's auth runtime for TanStack Start - `@vitnode/core/tanstack/auth`.
 *
 * Everything an application needs to sign somebody in, out, or up, minus the
 * three things a package cannot own: its route tree, its server functions, and
 * where a visitor goes next. What is left is the whole of the behaviour, and it
 * is one implementation rather than one per host.
 *
 *     ./contract          the schemas a browser's input is parsed by, and the
 *                         closed result union every mutation answers with
 *     ./state             the session as route state: AuthState, the guards,
 *                         and the one query key
 *     ./session-query     the canonical ["vitnode", "session"] entry - one
 *                         definition, read by every guard and component
 *     ./return-to         is this target somewhere we may send a browser at all
 *     ./redirects         and where does this flow send them
 *     ./screens           the contract in the vocabulary the shared auth views
 *                         speak
 *     ./recovery          which password-recovery screen a URL asks for, and
 *                         whether this deployment has the flow at all
 *     ./route-search      what `/login` and the SSO callback read out of their
 *                         URLs, as normalisers a crafted link cannot break
 *     ./middleware-config what this installation has configured: SSO adapters,
 *                         an email adapter, a captcha site key
 *     ./actions           the client orchestration - mutate, then bring the one
 *                         cache entry back in step, then navigate
 *     ./queries           what an identity boundary drops: the private-user
 *                         cache roots, the public half of the AdminCP's list
 *     ./transport         the eight server functions the host registers
 *
 * `@vitnode/core/tanstack/auth/server` is the other half: the request-scoped
 * calls to the Hono users API, including the cookie copying. It is a separate
 * subpath because this barrel is imported by browser bundles and that one may
 * never be.
 *
 * ## What stays in the application
 *
 * Three things, and each for a reason the boundary test states:
 *
 * - **`createServerFn`.** A host externalises this package from Vite's SSR pass,
 *   so package code reaches the server uncompiled - and an uncompiled server
 *   function silently resolves to `undefined` during SSR. The host declares
 *   eight one-line wrappers over `./server` and registers them; see
 *   `./transport`.
 * - **The route tree.** Guards and redirects are route composition. This package
 *   hands them the decisions (`canAccessGuestRoute`, `postAuthDestination`,
 *   `normalizeLoginSearch`) and never a `createFileRoute`. A route's *search
 *   contract* is not composition and is not left to the host: it describes what
 *   a stranger may put in that URL, which is the same question on every install.
 * - **Navigation.** `useSignInAction` and `useSignUpAction` take a `navigate`,
 *   because during the Next.js migration a post-login destination may still
 *   belong to the other application.
 *
 * There is deliberately no `AuthProvider`, no `AuthContext` and no auth store.
 * The QueryClient the host already owns holds the session, under one key, and
 * that is the whole architecture.
 */

export * from "./actions";
export * from "./contract";
export type { AuthLoaderContext, AuthRouteData } from "./login-route";
export { loadLoginRoute, LOGIN_NAMESPACES } from "./login-route";
export type { LoginRouteProps } from "./login-screen";
export { LoginRouteContent } from "./login-screen";
export * from "./middleware-config";
export { removeUserIdentityQueries } from "./queries";
export * from "./recovery";
export type { PasswordResetRouteData } from "./recovery-route";
export { loadPasswordResetRoute } from "./recovery-route";
export type { PasswordResetRouteProps } from "./recovery-screen";
export {
  PasswordRecoveryNotFound,
  PasswordResetRouteContent,
} from "./recovery-screen";
export * from "./redirects";
export { loadRegisterRoute, REGISTER_NAMESPACES } from "./register-route";
export type { RegisterRouteProps } from "./register-screen";
export { RegisterRouteContent } from "./register-screen";
export * from "./return-to";
export * from "./route-search";
export * from "./screens";
export type { SessionApi } from "./session-api";
export * from "./session-query";
export { loadSsoCallbackRoute, SSO_CALLBACK_NAMESPACES } from "./sso-route";
export type { SsoCallbackRouteProps } from "./sso-screen";
export { SsoCallbackRouteContent } from "./sso-screen";
export * from "./state";
export * from "./transport";
