import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { IdCardIcon, RotateCwIcon, UserRoundXIcon } from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import { useSessionQuery } from "@/tanstack/auth/session-query";
import { RouteMessages } from "@/tanstack/i18n/route-messages";
import { Reputation } from "@/tanstack/reactions/reputation";
import { userPresenceQueryOptions } from "@/views/presence/presence-query";
import { userCoverStyle } from "@/views/profile/images/cover-style";
import {
  isProfileNotFound,
  type UserProfile,
  userProfileQueryOptions,
} from "@/views/profile/profile-query";

import { Avatar } from "./avatar";
import { RoleFormat } from "./role-format";
import { Button } from "./ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { UserCoverImage } from "./user-cover-image";
import { UserPresenceStatus } from "./user-presence-status";
import { UserPreviewSkeleton } from "./user-preview-skeleton";
import { userProfileHref } from "./user-profile-href";

const USER_PREVIEW_NAMESPACES = ["core.global", "core.profile"] as const;
const SHOWN_SECONDARY_ROLES = 2;

const PreviewPresence = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.profile");
  const { data: session, isPending: isSessionPending } = useSessionQuery();
  const { data } = useQuery({
    ...userPresenceQueryOptions({
      userId,
      viewerId: session?.user?.id ?? null,
    }),
    enabled: !isSessionPending,
  });

  if (!data) return null;

  return (
    <li className="flex min-w-0 items-center">
      <span className="sr-only">{t("presence")}: </span>
      <UserPresenceStatus presence={data} variant="full" />
    </li>
  );
};

const PreviewRoles = ({ user }: { user: UserProfile }) => {
  const t = useTranslations("core.profile");
  const tGlobal = useTranslations("core.global");
  const shown = user.secondaryRoles.slice(0, SHOWN_SECONDARY_ROLES);
  const hidden = user.secondaryRoles.length - shown.length;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="sr-only">{t("role")}</span>
      <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <li className="min-w-0">
          <RoleFormat role={user.role} />
        </li>
        {shown.map(role => (
          <li className="min-w-0" key={role.id}>
            <RoleFormat className="font-normal" role={role} />
          </li>
        ))}
        {hidden > 0 ? (
          <li className="text-muted-foreground">
            {tGlobal("more_count", { count: hidden })}
          </li>
        ) : null}
      </ul>
    </div>
  );
};

const PreviewProfile = ({ user }: { user: UserProfile }) => {
  const t = useTranslations("core.profile");
  const format = useFormatter();
  const joinedAt = new Date(user.createdAt);

  return (
    <div className="flex flex-col">
      <div
        className="bg-muted h-20 w-full"
        data-slot="user-preview-cover"
        style={userCoverStyle(user.avatarColor)}
      >
        <UserCoverImage url={user.coverUrl} />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="-mt-8 flex items-end justify-between gap-3">
          <Avatar
            alt=""
            className="border-popover size-16 shrink-0 rounded-full border-4"
            size={64}
            user={user}
          />
          {typeof user.reputation === "number" ? (
            <Reputation value={user.reputation} />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col">
          <Link
            className="text-foreground focus-visible:ring-ring/50 truncate rounded-sm text-base font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3"
            to={userProfileHref(user.nameCode)}
          >
            {user.name}
          </Link>
          <p className="text-muted-foreground truncate text-sm">
            @{user.nameCode}
          </p>
        </div>

        {user.headline ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-pretty">
            <span className="sr-only">{t("headline")}: </span>
            {user.headline}
          </p>
        ) : null}

        <PreviewRoles user={user} />

        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <li>
            {t("preview.joined", {
              date: format.dateTime(joinedAt, {
                month: "short",
                year: "numeric",
              }),
            })}
          </li>
          <PreviewPresence userId={user.id} />
        </ul>
      </div>
    </div>
  );
};

const PreviewBody = ({ nameCode }: { nameCode: string }) => {
  const t = useTranslations("core.profile");
  const query = useQuery(userProfileQueryOptions({ nameCode }));

  if (query.isPending) return <UserPreviewSkeleton />;

  if (query.isError) {
    const notFound = isProfileNotFound(query.error);

    return (
      <Empty className="p-6" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {notFound ? (
              <UserRoundXIcon aria-hidden="true" />
            ) : (
              <IdCardIcon aria-hidden="true" />
            )}
          </EmptyMedia>
          <EmptyTitle>
            {notFound ? t("notFound.title") : t("preview.load_error.title")}
          </EmptyTitle>
          <EmptyDescription>
            {notFound ? t("notFound.desc") : t("preview.load_error.desc")}
          </EmptyDescription>
        </EmptyHeader>
        {notFound ? null : (
          <EmptyContent>
            <Button
              isLoading={query.isFetching}
              onClick={() => void query.refetch()}
              size="sm"
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {t("preview.retry")}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return <PreviewProfile user={query.data} />;
};

/**
 * The user preview card's content: loads its messages and the member's public
 * profile, showing a skeleton until both arrive. Lazy-loaded by
 * `UserPreview` when the card opens.
 */
export const UserPreviewCard = ({ nameCode }: { nameCode: string }) => (
  <React.Suspense fallback={<UserPreviewSkeleton />}>
    <RouteMessages namespaces={USER_PREVIEW_NAMESPACES}>
      <PreviewBody nameCode={nameCode} />
    </RouteMessages>
  </React.Suspense>
);
