import {
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { CatchBoundary, Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  HistoryIcon,
  NotebookTextIcon,
  RotateCwIcon,
  UserRoundPenIcon,
} from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import type { UserProfile } from "@/views/profile/profile-query";
import type { SearchTimelineOwner } from "@/views/search/types";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { UserPresenceStatus } from "@/components/user-presence-status";
import {
  userProfileContentHref,
  userProfileHref,
} from "@/components/user-profile-href";
import { USER_HEADER_HREF } from "@/views/layouts/theme/header/user/user-header-model";
import { userPresenceQueryOptions } from "@/views/presence/presence-query";
import { ProfileContent } from "@/views/profile/profile-content";
import { userProfileQueryKey } from "@/views/profile/profile-query";
import { profileTimelineQueryOptions } from "@/views/profile/profile-timeline-query";
import {
  ProfileWarnings,
  ProfileWarningsSkeleton,
} from "@/views/profile/warnings/profile-warnings";
import { SearchFeedList } from "@/views/search/search-feed-content";
import { SearchTimelineSkeleton } from "@/views/search/search-timeline-skeleton";

import type { ProfileRouteSearch } from "./route-search";

import { useSessionQuery } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { RouteMessages } from "../i18n/route-messages";
import { HrefLink } from "../link/href-link";
import { REPORT_NAMESPACES } from "../moderation/report-button";
import { ProfileContentTab, ProfileContentTabSkeleton } from "./content-tab";
import { useOwnUserImageEditor } from "./own-image-editor";
import { userProfileQuery } from "./query";
import { PROFILE_NAMESPACES, profileContentFilter } from "./route";

export interface ProfileRouteProps {
  children?: React.ReactNode;
  nameCode: string;
  /** The page's parsed query string: the tab and the Content filter. */
  search?: ProfileRouteSearch;
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

const ProfileWarningsSlot = ({
  isOwner,
  userId,
}: {
  isOwner: boolean;
  userId: number;
}) => (
  <React.Suspense fallback={<ProfileWarningsSkeleton />}>
    <RouteMessages namespaces={REPORT_NAMESPACES}>
      <ProfileWarnings isOwner={isOwner} userId={userId} />
    </RouteMessages>
  </React.Suspense>
);

// Suspense, not `isPending`: the loader streams this query, so a plain read
// renders the skeleton on the server and the list in the browser.
const ProfileTimelineList = ({
  owner,
  viewerId,
}: {
  owner: SearchTimelineOwner;
  viewerId: null | number;
}) => {
  const locale = useLocale();
  const query = useSuspenseInfiniteQuery(
    profileTimelineQueryOptions({ locale, userId: owner.id, viewerId }),
  );

  return <SearchFeedList owner={owner} query={query} variant="timeline" />;
};

const ProfileTimelineError = ({ reset }: { reset: () => void }) => {
  const t = useTranslations("core.profile.timeline_load_error");
  const tErrors = useTranslations("core.global.errors");
  const { reset: resetQueries } = useQueryErrorResetBoundary();

  return (
    <Empty className="border" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HistoryIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{t("desc")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() => {
            resetQueries();
            reset();
          }}
          variant="outline"
        >
          <RotateCwIcon aria-hidden="true" />
          {tErrors("try_again")}
        </Button>
      </EmptyContent>
    </Empty>
  );
};

const ProfileTimeline = ({
  owner,
  viewerId,
}: {
  owner: SearchTimelineOwner;
  viewerId: null | number;
}) => (
  <CatchBoundary
    errorComponent={ProfileTimelineError}
    getResetKey={() => `${owner.id}:${viewerId}`}
  >
    <React.Suspense fallback={<SearchTimelineSkeleton />}>
      <ProfileTimelineList owner={owner} viewerId={viewerId} />
    </React.Suspense>
  </CatchBoundary>
);

const TabLink = ({
  active,
  children,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}) => (
  <li>
    <HrefLink
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-3 motion-safe:transition-colors",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
      href={href}
      resetScroll={false}
    >
      {children}
    </HrefLink>
  </li>
);

/**
 * The profile's feed: Activity (what they wrote and reacted to) and, with an
 * API that counts it, Content (only what they authored, filterable by type).
 * The tab and the filter live in the query string, so links, back and forward
 * work.
 */
const ProfileSections = ({
  owner,
  search,
  viewerId,
}: {
  owner: UserProfile;
  search: ProfileRouteSearch;
  viewerId: null | number;
}) => {
  const t = useTranslations("core.profile");
  const format = useFormatter();
  const titleId = React.useId();
  const stats = owner.contentStats;
  const onContent = search.tab === "content" && stats !== undefined;

  if (!stats) {
    return (
      <section aria-labelledby={titleId} className="flex flex-col gap-4">
        <h2
          className="text-foreground text-lg font-semibold text-balance"
          id={titleId}
        >
          {t("timeline")}
        </h2>
        <ProfileTimeline owner={owner} viewerId={viewerId} />
      </section>
    );
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h2 className="sr-only" id={titleId}>
        {onContent ? t("tabs.content") : t("tabs.activity")}
      </h2>
      <nav aria-label={t("tabs.label")}>
        <ul className="bg-muted inline-flex items-center gap-1 rounded-lg p-1">
          <TabLink active={!onContent} href={userProfileHref(owner.nameCode)}>
            <HistoryIcon aria-hidden="true" className="size-4" />
            {t("tabs.activity")}
          </TabLink>
          <TabLink
            active={onContent}
            href={userProfileContentHref(owner.nameCode)}
          >
            <NotebookTextIcon aria-hidden="true" className="size-4" />
            {t("tabs.content")}
            <span className="text-muted-foreground tabular-nums">
              {format.number(stats.total)}
            </span>
          </TabLink>
        </ul>
      </nav>
      {onContent ? (
        <React.Suspense fallback={<ProfileContentTabSkeleton />}>
          <ProfileContentTab
            owner={owner}
            stats={stats}
            type={profileContentFilter(owner, search.type)}
          />
        </React.Suspense>
      ) : (
        <ProfileTimeline owner={owner} viewerId={viewerId} />
      )}
    </section>
  );
};

const ProfileScreen = ({
  children,
  nameCode,
  search = {},
}: ProfileRouteProps) => {
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
      aside={
        isOwner || session?.user?.isModerator ? (
          <ProfileWarningsSlot isOwner={isOwner} userId={user.id} />
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
      <ProfileSections owner={user} search={search} viewerId={viewerId} />
      {children}
    </ProfileContent>
  );
};

export const ProfileRouteContent = ({
  children,
  nameCode,
  search,
}: ProfileRouteProps) => (
  <RouteMessages namespaces={PROFILE_NAMESPACES}>
    <ProfileScreen nameCode={nameCode} search={search}>
      {children}
    </ProfileScreen>
  </RouteMessages>
);
