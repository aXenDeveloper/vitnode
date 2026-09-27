import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { HeaderNavItem } from "@/views/layouts/theme/header/header-nav";

import { MobileUserMenuContent } from "@/views/layouts/theme/header/mobile-nav/mobile-user-menu";
import { userHeaderState } from "@/views/layouts/theme/header/user/user-header-model";

import { useSignOutAction } from "../auth/actions";
import { useSessionQuery } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { useSwitchLocale } from "../i18n/switch-locale";

export const MobileUserMenu = ({
  hasNavigation,
  navigation,
}: {
  hasNavigation: boolean;
  navigation: HeaderNavItem[];
}) => {
  const { data, isError } = useSessionQuery();
  const signOut = useSignOutAction();
  const locale = useLocale();
  const switchLocale = useSwitchLocale();
  const tErrors = useTranslations("core.global.errors");

  const onSignOut = async () => {
    const result = await signOut();

    if (result.ok) return;

    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  return (
    <MobileUserMenuContent
      currentLocale={locale}
      hasNavigation={hasNavigation}
      navigation={navigation}
      onSelectLocale={switchLocale}
      onSignOut={onSignOut}
      state={userHeaderState({ isError, session: data })}
    />
  );
};
