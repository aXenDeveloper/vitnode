import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { UserRoundPenIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";
import { UserPresenceStatus } from "@/components/user-presence-status";
import { USER_HEADER_HREF } from "@/views/layouts/theme/header/user/user-header-model";
import { userPresenceQueryOptions } from "@/views/presence/presence-query";
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

const ProfilePresence = ({
  userId,
  viewerId,
  viewerKnown,
}: {
  userId: number;
  viewerId: null | number;
  viewerKnown: boolean;
}) => {
  const t = useTranslations("core.profile");
  // Browser-only, keyed by viewer: it never lands in SSR output or the page
  // cache, and waits for the session so a guest's answer isn't fetched first.
  const { data } = useQuery({
    ...userPresenceQueryOptions({ userId, viewerId }),
    enabled: viewerKnown,
  });

  if (!data) return null;

  return (
    <p className="flex items-center" data-slot="profile-presence">
      <span className="sr-only">{t("presence")}: </span>
      <UserPresenceStatus presence={data} variant="full" />
    </p>
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
      <SearchFeedList ownerId={userId} query={query} variant="timeline" />
    </section>
  );
};

const ProfileScreen = ({ children, nameCode }: ProfileRouteProps) => {
  const { data: user } = useSuspenseQuery(userProfileQuery(nameCode));
  const { data: session, isPending: isSessionPending } = useSessionQuery();
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
      presence={
        <ProfilePresence
          userId={user.id}
          viewerId={viewerId}
          viewerKnown={!isSessionPending}
        />
      }
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
