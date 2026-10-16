import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { UserBarAdminContent } from "@/views/admin/layouts/user-bar/user-bar-content";

import { useSignOutAction } from "../auth/actions";
import { LanguageSwitcher } from "../layout/language-switcher";
import { useAdminUser } from "./permissions";
import { removeAdminIdentityQueries } from "./queries";

const DebugStatus = React.lazy(async () =>
  import("./debug/status").then(module => ({ default: module.DebugStatus })),
);

export const AdminUserBar = () => {
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
      debugStatus={
        <React.Suspense fallback={null}>
          <DebugStatus />
        </React.Suspense>
      }
      languageSwitcher={<LanguageSwitcher />}
      onSignOut={handleSignOut}
      user={user}
    />
  );
};
