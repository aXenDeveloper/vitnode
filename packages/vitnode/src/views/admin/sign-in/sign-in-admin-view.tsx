import { I18nProvider } from "@/components/i18n-provider";
import { FormSignIn } from "@/views/auth/sign-in/form/form";

import { SignInAdminContent } from "./sign-in-admin-content";

/**
 * {@link SignInAdminContent}, wired to Next.js.
 *
 * Unchanged behaviour: the same server-rendered message provider, the same
 * `FormSignIn` in admin mode, the same absent reset-password link. What moved is
 * the markup around the form, which now lives in the shared screen so the
 * TanStack Start route renders the identical card rather than a second copy of
 * it that drifts.
 *
 * `FormSignIn` rather than the mutation directly, because a Server Component
 * cannot hand an inline closure to a client component - only a server action -
 * and that wrapper is where the action is closed over. `isAdmin` is the whole of
 * what it changes, and it is the argument that selects the admin session.
 *
 * The TanStack Start counterpart is `AdminSignInRouteContent` in
 * `@vitnode/core/tanstack/admin`.
 */
export const SignInAdminView = () => (
  <I18nProvider namespaces={["core.auth.sign_in"]}>
    <SignInAdminContent form={<FormSignIn isAdmin isEmail={false} />} />
  </I18nProvider>
);
