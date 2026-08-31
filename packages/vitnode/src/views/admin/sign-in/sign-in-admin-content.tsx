import { LogoVitNode } from "@/components/logo-vitnode";
import { Card } from "@/components/ui/card";

/**
 * The AdminCP's front door - shared, so both frontends render the same one.
 *
 * The whole of what used to be `SignInAdminView`'s body, with the one Next.js
 * thing lifted out. `form` is a slot rather than an import for the same reason
 * it is one on the public `SignInContent`: what fills it differs by framework
 * and only by framework. Next.js passes `FormSignIn`, a client wrapper that
 * closes over a server action; a TanStack Start route passes `SignInFormContent`
 * with a server function behind it. The logo, the card and the spacing are here
 * once.
 *
 * Framework-free and hook-free, so it renders as a Server Component under
 * Next.js exactly as `SignInAdminView` always did, and inside the router's
 * client tree without a boundary of its own.
 *
 * ## Why this is not the public login page with different styling
 *
 * It signs in against a *different session*. The API branches on `isAdmin` and
 * calls `SessionAdminModel.createSessionByUserId`, which mints the
 * `vitnode_auth_admin` cookie and leaves the public one untouched - so this form
 * is not a shortcut to `/login`, and finishing it does not sign anybody into the
 * public site. The caller supplies that flag with the mutation, which is the
 * only layer that ever cared.
 *
 * ## No reset-password link, deliberately
 *
 * Neither caller passes one, which the AdminCP has always expressed as
 * `isEmail={false}` regardless of whether an email adapter is configured.
 * Recovering an administrator's password is a public-site flow, and offering it
 * here would send somebody out of the AdminCP mid-sign-in and onto the other
 * application. It also means this screen renders no links at all, which is what
 * lets it be identical under a router and under Next.js with no navigation seam.
 */
export const SignInAdminContent = ({ form }: { form: React.ReactNode }) => (
  <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-10 px-4 py-16">
    <LogoVitNode className="w-64" />
    <Card className="w-full p-6">{form}</Card>
  </div>
);
