"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { UserBarAdminContent } from "@/views/admin/layouts/user-bar/user-bar-content";

import { useSignOutAction } from "../auth/actions";
import { useAdminUser } from "./permissions";
import { removeAdminIdentityQueries } from "./queries";

/**
 * The AdminCP user menu, on TanStack Start.
 *
 * Everything visible is `UserBarAdminContent`'s. What is here is the two things
 * it refuses to decide - who is signed in, and what signing out means - and both
 * come from the canonical state rather than from anything invented here.
 *
 *     the admin    ->  useAdminUser()      the one admin-session query
 *     sign-out     ->  useSignOutAction()  the one auth action, Stage 6's
 *
 * There is no second session, no admin context of this component's own and no
 * second sign-out. `useAdminUser` reads the identical `adminSessionQueryOptions`
 * object `_admin`'s guard warmed, so the menu cannot name somebody the guard has
 * already turned away.
 *
 * ## What sign-out has to accomplish, and who does each part
 *
 *     DELETE /sign_out, admin cookie cleared   the shared action -> the API
 *     public session reset to anonymous        the shared action
 *     everything privileged this admin held    the shared action
 *                                              (removeAdminIdentityQueries)
 *     leaves the protected AdminCP             router.invalidate() -> _admin's guard
 *     nothing re-created during the teardown   the second sweep below
 *
 * The action owns the cleanup - the session entry *and* every AdminCP screen
 * family, through the one canonical list in `./queries`. This component adds a
 * second sweep after the sign-out has resolved, and only because of *when* it
 * runs: the action clears before `router.invalidate()`, while the panel is still
 * mounted, so an observer that re-renders in that window can put an entry back
 * before the guard redirects. Sweeping again once the action has finished is
 * what stops one of those surviving into the next administrator's session.
 *
 * None of this is a security boundary. The admin cookie is what authorizes an
 * admin read, and Hono re-checks it on every request whatever this cache says.
 *
 * ## There is deliberately no `onSignOut` override
 *
 * An earlier draft took one, so a host could "do something extra". What it
 * actually offered was a way to replace the sequence above with a partial copy
 * of it - and the part a host would most easily leave out is the cache clearing,
 * which is invisible until a second administrator signs in on the same tab and
 * is served the first one's search results. A host that needs something extra
 * has `queryClient` and the same action; it does not need this component to hand
 * over the whole flow.
 *
 * ## A failed sign-out leaves them signed in, and says so
 *
 * The action reports failure rather than throwing, and the honest response is
 * the internal-error toast with the menu unchanged: a session that could not be
 * ended is still a session, and clearing the UI would claim otherwise. The same
 * choice the public header makes for the same answer.
 */
export const AdminUserBar = ({
  LinkComponent,
}: {
  LinkComponent: AuthLinkComponent;
}) => {
  const user = useAdminUser();
  const signOut = useSignOutAction();
  const queryClient = useQueryClient();
  const tErrors = useTranslations("core.global.errors");

  /**
   * Rendered by a shell whose guard has already decided access, so "no admin"
   * is not an error state here - it is the instant between a sign-out and the
   * redirect the guard performs. Rendering nothing is the whole correct
   * response.
   */
  if (!user) return null;

  const handleSignOut = async () => {
    const result = await signOut({ isAdmin: true });

    if (!result.ok) {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });

      return;
    }

    removeAdminIdentityQueries(queryClient);
  };

  return (
    <UserBarAdminContent
      LinkComponent={LinkComponent}
      onSignOut={handleSignOut}
      user={user}
    />
  );
};
