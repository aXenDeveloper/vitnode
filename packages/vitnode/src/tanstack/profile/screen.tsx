import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ShieldIcon, TriangleAlertIcon, UserRoundPenIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { UserPresenceStatus } from "@/components/user-presence-status";
import { USER_HEADER_HREF } from "@/views/layouts/theme/header/user/user-header-model";
import { memberStandingQueryOptions } from "@/views/moderation/warnings/warnings-api";
import { userPresenceQueryOptions } from "@/views/presence/presence-query";
import { ProfileContent } from "@/views/profile/profile-content";
import { userProfileQueryKey } from "@/views/profile/profile-query";
import { profileTimelineQueryOptions } from "@/views/profile/profile-timeline-query";
import { SearchFeedList } from "@/views/search/search-feed-content";

import { useSessionQuery } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { RouteMessages } from "../i18n/route-messages";
import { WarnDialog } from "../moderation/warn-button";
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

/**
 * Warn and View warnings for moderators. Shown only when the server's
 * standing route answers for this member - it decides who may warn directly.
 */
const ModeratorActions = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.profile");
  const [open, setOpen] = React.useState(false);
  const { data } = useQuery(memberStandingQueryOptions(userId));
  if (!data) return null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Link
        className={cn(buttonVariants({ variant: "outline" }))}
        to={`/modcp/members/${userId}`}
      >
        <ShieldIcon aria-hidden="true" />
        {t("view_warnings", { points: data.activePoints })}
      </Link>
      {data.permissions.warn ? (
        <>
          <Button
            onClick={() => {
              setOpen(true);
            }}
            variant="outline"
          >
            <TriangleAlertIcon aria-hidden="true" />
            {t("warn")}
          </Button>
          <WarnDialog onOpenChange={setOpen} open={open} userId={userId} />
        </>
      ) : null}
    </div>
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
      action={
        isOwner ? (
          <EditProfileAction />
        ) : session?.user?.isModerator ? (
          <ModeratorActions userId={user.id} />
        ) : null
      }
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
