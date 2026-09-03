"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { UserBarAdminContent } from "@/views/admin/layouts/user-bar/user-bar-content";

import { useSignOutAction } from "../auth/actions";
import { useAdminUser } from "./permissions";
import { removeAdminIdentityQueries } from "./queries";

export const AdminUserBar = ({
  LinkComponent,
}: {
  LinkComponent: AuthLinkComponent;
}) => {
  const user = useAdminUser();
  const signOut = useSignOutAction();
  const queryClient = useQueryClient();
  const tErrors = useTranslations("core.global.errors");

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
