import {
  useInfiniteQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { UserRoundPenIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";
import { USER_HEADER_HREF } from "@/views/layouts/theme/header/user/user-header-model";
import { ProfileContent } from "@/views/profile/profile-content";
import { userProfileQueryKey } from "@/views/profile/profile-query";
import { profileTimelineQueryOptions } from "@/views/profile/profile-timeline-query";
import { SearchFeedList } from "@/views/search/search-feed-content";

import { useSessionQuery } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { RouteMessages } from "../i18n/route-messages";
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
    <Link
      className={cn(buttonVariants({ variant: "outline" }))}
      to={USER_HEADER_HREF.settings}
    >
      <UserRoundPenIcon aria-hidden="true" />
      {t("editProfile")}
    </Link>
  );
};

const ProfileTimeline = ({
  userId,
  viewerId,
}: {
  userId: number;
  viewerId: null | number;
}) => {
  const t = useTranslations("core.profile");
  const locale = useLocale();
  const titleId = React.useId();
  const query = useInfiniteQuery(
    profileTimelineQueryOptions({ locale, userId, viewerId }),
  );

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h2
        className="text-foreground text-lg font-semibold text-balance"
        id={titleId}
      >
        {t("timeline")}
      </h2>
      <SearchFeedList query={query} variant="timeline" />
    </section>
  );
};

const ProfileScreen = ({ children, nameCode }: ProfileRouteProps) => {
  const { data: user } = useSuspenseQuery(userProfileQuery(nameCode));
  const { data: session } = useSessionQuery();
  const queryClient = useQueryClient();
  const viewerId = session?.user?.id ?? null;
  const isOwner = viewerId === user.id;
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
      <ProfileTimeline userId={user.id} viewerId={viewerId} />
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
