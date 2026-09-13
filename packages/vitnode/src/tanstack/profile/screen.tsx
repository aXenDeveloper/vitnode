import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { UserRoundPenIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";
import { USER_HEADER_HREF } from "@/views/layouts/theme/header/user/user-header-model";
import { ProfileContent } from "@/views/profile/profile-content";
import { userProfileQueryKey } from "@/views/profile/profile-query";

import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import { RouterLink } from "../layout/router-link";
import { useOwnUserImageEditor } from "./own-image-editor";
import { userProfileQuery } from "./query";
import { PROFILE_NAMESPACES } from "./route";

export interface ProfileRouteProps {
  children?: React.ReactNode;
  nameCode: string;
}

const EditProfileAction = () => {
  const t = useTranslations("core.profile");

  return (
    <RouterLink
      className={cn(buttonVariants({ variant: "outline" }))}
      href={USER_HEADER_HREF.settings}
    >
      <UserRoundPenIcon aria-hidden="true" />
      {t("editProfile")}
    </RouterLink>
  );
};

const ProfileScreen = ({ children, nameCode }: ProfileRouteProps) => {
  const { data: user } = useSuspenseQuery(userProfileQuery(nameCode));
  const { data: session } = useSessionQuery();
  const queryClient = useQueryClient();
  const isOwner = session?.user?.id === user.id;
  const refresh = React.useCallback(
    async () =>
      await queryClient.invalidateQueries({
        queryKey: userProfileQueryKey(nameCode),
      }),
    [nameCode, queryClient],
  );
  const editor = useOwnUserImageEditor({ enabled: isOwner, refresh });

  return (
    <ProfileContent
      action={isOwner ? <EditProfileAction /> : null}
      editor={editor}
      user={user}
    >
      {children}
    </ProfileContent>
  );
};

export const ProfileRouteContent = ({
  children,
  nameCode,
}: ProfileRouteProps) => (
  <RouteMessages namespaces={PROFILE_NAMESPACES}>
    <ProfileScreen nameCode={nameCode}>{children}</ProfileScreen>
  </RouteMessages>
);
