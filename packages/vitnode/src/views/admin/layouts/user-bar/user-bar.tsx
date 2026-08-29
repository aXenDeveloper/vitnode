"use client";

import { Link } from "@/lib/navigation";
import { logOutMutationApi } from "@/views/layouts/theme/header/user/auth/log-out-mutation-api.server";

import type { AdminUserBarUser } from "./user-bar-content";

import { UserBarAdminContent } from "./user-bar-content";

/**
 * {@link UserBarAdminContent}, wired to Next.js.
 *
 * The two framework answers: `next-intl`'s locale-aware `Link`, and the
 * `"use server"` sign-out this application has always used. A TanStack Start
 * host passes `useSignOutAction()` instead, which additionally resets the
 * canonical session cache - a Server Action has no cache to reset, because the
 * page it lands on is rendered fresh.
 */
export const UserBarAdmin = ({ user }: { user: AdminUserBarUser }) => (
  <UserBarAdminContent
    LinkComponent={Link}
    onSignOut={async () => {
      await logOutMutationApi({ isAdmin: true });
    }}
    user={user}
  />
);
