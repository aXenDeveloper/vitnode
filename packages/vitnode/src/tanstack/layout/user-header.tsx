import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { UserHeaderContent } from "@/views/layouts/theme/header/user/user-header-content";
import { userHeaderState } from "@/views/layouts/theme/header/user/user-header-model";

import { useSignOutAction } from "../auth/actions";
import { useSessionQuery } from "../auth/session-query";
import { LanguageSwitcher } from "./language-switcher";

export const UserHeader = () => {
  const { data, isError } = useSessionQuery();
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
      languageSwitcher={<LanguageSwitcher />}
      onSignOut={onSignOut}
      state={userHeaderState({ isError, session: data })}
    />
  );
};
