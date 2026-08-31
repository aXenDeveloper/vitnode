import type {
  ChangePasswordInput,
  ChangePasswordResult,
  CompleteSsoResult,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
  SignInInput,
  SignInResult,
  SignOutInput,
  SignOutResult,
  SignUpInput,
  SignUpResult,
  SsoCallbackInput,
  SsoStartInput,
  SsoStartResult,
} from "./contract";
import type { SessionApi } from "./session-api";

/**
 * How this package reaches the API, handed to it by the application.
 *
 * Eight calls, and every one of them is `createServerFn` in the host. That is
 * not a preference, it is the one thing a package cannot own: the host
 * externalises `@vitnode/core` from Vite's SSR pass, so this code reaches the
 * server *uncompiled* - and an uncompiled `createServerFn` hands its
 * `.handler()` one argument where the compiler passes two, which makes an
 * SSR-side call resolve to `undefined` with no error at all. It would work in
 * the browser, over `/_serverFn/*`, and silently answer nothing during a render.
 * See `packages/vitnode/src/tanstack/boundary.test.ts`, which forbids the
 * primitive here outright.
 *
 * So the *declaration* stays in `apps/web`, where the Start compiler sees it on
 * both sides, and everything the declaration would otherwise contain - the
 * validation, the Hono call, the cookie copying, the status mapping - lives in
 * `./server`. What crosses the boundary is this interface: eight functions from
 * a validated input to one of the closed results in `./contract`.
 *
 *     apps/web              @vitnode/core/tanstack/auth
 *     ------------------------------------------------------------------
 *     createServerFn        ./server      call Hono, copy cookies, map status
 *       .validator(schema)  ./contract    the schema, and the result union
 *       .handler(fn)        ./actions     what to do with the answer
 *
 * ## This is a transport, not an auth store
 *
 * Nothing here holds a session, a user, or any state a component could read.
 * The canonical session lives in exactly one place - the `["vitnode",
 * "session"]` entry in the host's `QueryClient` - and `./session-query` is the
 * only definition of it. This registry holds function references, which are the
 * same for every visitor and every request, which is why a module-level value is
 * safe on a server that renders many visitors at once.
 */
export interface AuthTransport {
  changePasswordFromReset: (
    input: ChangePasswordInput,
  ) => Promise<ChangePasswordResult>;
  completeSso: (input: SsoCallbackInput) => Promise<CompleteSsoResult>;
  /**
   * The visitor's session, or a rejection.
   *
   * `{ user: null }` means the API answered and nobody is signed in; a read that
   * could not be evaluated at all - a 429, a 500, an unreachable API - must
   * *reject* rather than resolving to a guest. `readSessionOnApi` in `./server`
   * is the implementation the host wraps, and it already draws that line.
   */
  readSession: () => Promise<SessionApi>;
  requestPasswordReset: (
    input: PasswordResetRequestInput,
  ) => Promise<PasswordResetRequestResult>;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signOut: (input: SignOutInput) => Promise<SignOutResult>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  startSso: (input: SsoStartInput) => Promise<SsoStartResult>;
}

let registered: AuthTransport | undefined;

/**
 * The message a caller gets when the application forgot to register.
 *
 * A named constant so the host's own test can assert on it without matching
 * English, and so the sentence says what to do rather than what went wrong.
 */
export const AUTH_TRANSPORT_MISSING =
  "No auth transport is registered. Call setAuthTransport() from a module the application always loads - the router entry - before any auth route runs.";

/**
 * Register the application's server functions, once, at module scope.
 *
 * Called from a module both bundles load (`apps/web/src/router.tsx` imports the
 * host's `lib/auth.ts` for exactly this), so the registry is filled before any
 * route, loader or component can reach for it. Registering twice replaces the
 * previous value rather than throwing: a hot reload re-evaluates the module, and
 * a build error is a worse answer than the newer function.
 *
 * Module scope means *per bundle*. The browser has one instance and the server
 * has one instance, and each registers its own - which is the same lifetime the
 * server functions themselves have.
 */
export const setAuthTransport = (transport: AuthTransport): void => {
  registered = transport;
};

/**
 * The registered transport, or a failure that says what is missing.
 *
 * Read at call time rather than captured at module scope, so a module that
 * merely *imports* an action does not have to be loaded after the registration -
 * only the call has to happen after it, which is trivially true for anything a
 * route can reach.
 */
export const authTransport = (): AuthTransport => {
  if (!registered) throw new Error(AUTH_TRANSPORT_MISSING);

  return registered;
};

/** Whether an application has registered a transport yet. For tests. */
export const hasAuthTransport = (): boolean => registered !== undefined;
