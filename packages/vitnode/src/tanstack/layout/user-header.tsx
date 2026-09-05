"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { UserHeaderLinkComponent } from "@/views/layouts/theme/header/user/user-header-model";

import { UserHeaderContent } from "@/views/layouts/theme/header/user/user-header-content";
import { userHeaderState } from "@/views/layouts/theme/header/user/user-header-model";

import { useSignOutAction } from "../auth/actions";
import { sessionQueryOptions } from "../auth/session-query";
import { RouterLink } from "./router-link";

export const UserHeader = ({
  LinkComponent = RouterLink,
}: {
  /** How a menu path becomes a navigation. See {@link RouterLink}. */
  LinkComponent?: UserHeaderLinkComponent;
}) => {
  const { data, isError } = useQuery(sessionQueryOptions());
  const signOut = useSignOutAction();
  const tErrors = useTranslations("core.global.errors");

  const onSignOut = async () => {
    const result = await signOut();

    if (result.ok) return;

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  return (
    <UserHeaderContent
      LinkComponent={LinkComponent}
      onSignOut={onSignOut}
      state={userHeaderState({ isError, session: data })}
    />
  );
};
