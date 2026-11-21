import type { UserPresence } from "@vitnode/api/lib/user-presence";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  IdCardIcon,
  RotateCwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserRoundXIcon,
} from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "use-intl";

import { useSessionQuery } from "@/tanstack/auth/session-query";
import { RouteMessages } from "@/tanstack/i18n/route-messages";
import { ModcpRequestError } from "@/views/moderation/modcp/modcp-query";
import { memberStandingQueryOptions } from "@/views/moderation/warnings/warnings-api";
import { userPresenceQueryOptions } from "@/views/presence/presence-query";
import { userCoverStyle } from "@/views/profile/images/cover-style";
import {
  isProfileNotFound,
  type UserProfile,
  userProfileQueryOptions,
} from "@/views/profile/profile-query";

import { Avatar } from "./avatar";
import { RoleFormat } from "./role-format";
import { Button, buttonVariants } from "./ui/button";
import { DrawerTitle } from "./ui/drawer";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { FEEDBACK_TONE_TEXT } from "./ui/feedback-tone";
import { ShortNumber } from "./ui/short-number";
import { Skeleton } from "./ui/skeleton";
import { UserCoverImage } from "./user-cover-image";
import { UserPreviewSkeleton } from "./user-preview-skeleton";
import { userProfileHref } from "./user-profile-href";

const USER_PREVIEW_NAMESPACES = ["core.global", "core.profile"] as const;
const AVATAR_SIZE = 56;
const PRESENCE_DOT_SIZE = 12;
const CIRCLE_EDGE_INSET_AT_45_DEG = (1 - Math.SQRT1_2) / 2;

const EASED_COVER_FADE =
  "linear-gradient(to bottom, black 0%, rgb(0 0 0 / 0.85) 30%, rgb(0 0 0 / 0.45) 60%, rgb(0 0 0 / 0.12) 85%, transparent 100%)";

/** Where the preview renders: a hover card, or a bottom sheet on touch screens. */
export type UserPreviewSurface = "card" | "sheet";

const ELAPSED_UNITS = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
] as const;

const formatElapsed = (date: Date | string, now: Date, locale: string) => {
  const seconds = Math.max(
    0,
    (now.getTime() - new Date(date).getTime()) / 1000,
  );
  const [unit, size] = ELAPSED_UNITS.find(
    ([, length]) => seconds >= length,
  ) ?? ["minute", 60];

  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
  }).format(Math.max(1, Math.floor(seconds / size)));
};

const PresenceAvatar = ({
  presence,
  user,
}: {
  presence: undefined | UserPresence;
  user: UserProfile;
}) => {
  const t = useTranslations("core.global.presence");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });

  let label: null | string = null;
  if (presence?.status === "online") {
    label = t("online_now");
  } else if (presence?.status === "offline") {
    label = presence.lastSeenAt
      ? t("last_seen", {
          time: format.relativeTime(new Date(presence.lastSeenAt), now),
        })
      : t("offline");
  }
  const offset = Math.round(
    AVATAR_SIZE * CIRCLE_EDGE_INSET_AT_45_DEG - PRESENCE_DOT_SIZE / 2,
  );

  return (
    <span className="relative inline-flex size-fit shrink-0">
      <Avatar
        alt=""
        className="ring-popover/60 size-14 ring-4"
        size={AVATAR_SIZE}
        user={user}
      />
      {label ? (
        <span
          aria-label={label}
          className={cn(
            "ring-popover absolute size-3 rounded-full ring-2",
            presence?.status === "online"
              ? "bg-success"
              : "bg-muted-foreground",
          )}
          role="img"
          style={{ bottom: offset, right: offset }}
          title={label}
        />
      ) : null}
    </span>
  );
};

const Stat = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex min-w-0 flex-col items-center gap-0.5 px-1 py-3">
    <dd className="text-foreground max-w-full truncate text-base font-semibold tabular-nums">
      {children}
    </dd>
    <dt className="text-muted-foreground text-sm">{label}</dt>
  </div>
);

const LastVisited = ({ presence }: { presence: undefined | UserPresence }) => {
  const t = useTranslations("core.profile.preview");
  const locale = useLocale();
  const now = useNow({ updateInterval: 60_000 });

  if (!presence) return <>-</>;
  if (presence.status === "hidden") return <>{t("hidden")}</>;
  if (presence.status === "online") {
    return (
      <span className={FEEDBACK_TONE_TEXT.success}>{t("online_now")}</span>
    );
  }

  return (
    <>
      {presence.lastSeenAt
        ? formatElapsed(presence.lastSeenAt, now, locale)
        : t("never")}
    </>
  );
};

const ModeratorWarnings = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.profile.preview.warnings");
  const tPreview = useTranslations("core.profile.preview");
  const query = useQuery(memberStandingQueryOptions(userId));

  if (query.isPending) {
    return (
      <div className="border-t px-4 py-3">
        <Skeleton className="h-14 rounded-lg" />
      </div>
    );
  }

  if (query.isError) {
    if (
      query.error instanceof ModcpRequestError &&
      query.error.status === 403
    ) {
      return null;
    }

    return (
      <div className="border-t px-4 py-3">
        <div
          className="text-muted-foreground flex items-center justify-between gap-3 text-sm"
          role="alert"
        >
          <span>{t("load_error")}</span>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            size="xs"
            variant="ghost"
          >
            <RotateCwIcon aria-hidden="true" />
            {tPreview("retry")}
          </Button>
        </div>
      </div>
    );
  }

  const { activePoints, hiddenWarnings, warnings } = query.data;
  const active = warnings.filter(warning => warning.status === "active").length;
  const total = warnings.length + hiddenWarnings;
  const flagged = activePoints > 0;

  return (
    <section aria-label={t("label")} className="border-t px-4 py-3">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5",
          flagged ? "bg-warn/10 dark:bg-warn/15" : "bg-muted/60",
        )}
      >
        {flagged ? (
          <TriangleAlertIcon
            aria-hidden="true"
            className={cn("size-5 shrink-0", FEEDBACK_TONE_TEXT.warning)}
          />
        ) : (
          <ShieldCheckIcon
            aria-hidden="true"
            className="text-muted-foreground size-5 shrink-0"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-foreground text-sm font-medium">
            {flagged ? t("points", { count: activePoints }) : t("none")}
          </p>
          <p className="text-muted-foreground text-sm">
            {total === 0 ? t("clean") : t("summary", { active, total })}
          </p>
        </div>
        {total > 0 ? (
          <Link
            className="text-foreground focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-0.5 rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
            to={`/modcp/warnings?user=${userId}`}
          >
            {t("review")}
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </section>
  );
};

const PreviewProfile = ({
  fadeIn,
  user,
}: {
  fadeIn: boolean;
  user: UserProfile;
}) => {
  const t = useTranslations("core.profile.preview");
  const locale = useLocale();
  const now = useNow({ updateInterval: 60_000 });
  const { data: session, isPending: isSessionPending } = useSessionQuery();
  const { data: presence } = useQuery({
    ...userPresenceQueryOptions({
      userId: user.id,
      viewerId: session?.user?.id ?? null,
    }),
    enabled: !isSessionPending,
  });
  const href = userProfileHref(user.nameCode);
  const reputation = user.reputation ?? 0;

  return (
    <div
      className={cn(
        "flex flex-col",
        fadeIn &&
          "ease-fluid transition-opacity duration-200 motion-reduce:transition-none starting:opacity-0",
      )}
    >
      <div className="relative isolate flex flex-col gap-3 px-4 pt-14 pb-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 opacity-70"
          data-slot="user-preview-cover"
          style={{
            ...userCoverStyle(user.avatarColor),
            maskImage: EASED_COVER_FADE,
            WebkitMaskImage: EASED_COVER_FADE,
          }}
        >
          <UserCoverImage url={user.coverUrl} />
        </div>
        <PresenceAvatar presence={presence} user={user} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            className="text-foreground focus-visible:ring-ring/50 truncate rounded-sm text-base font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3"
            to={href}
          >
            {user.name}
          </Link>
          <p className="text-muted-foreground truncate text-sm">
            @{user.nameCode}
          </p>
          <RoleFormat className="text-sm" role={user.role} />
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x border-t">
        <Stat label={t("reputation")}>
          <ShortNumber
            className={cn(
              reputation > 0 && FEEDBACK_TONE_TEXT.success,
              reputation < 0 && FEEDBACK_TONE_TEXT.destructive,
            )}
            formatOptions={{ signDisplay: "exceptZero" }}
            value={reputation}
          />
        </Stat>
        <Stat label={t("joined")}>
          <time dateTime={new Date(user.createdAt).toISOString()}>
            {formatElapsed(user.createdAt, now, locale)}
          </time>
        </Stat>
        <Stat label={t("last_visited")}>
          <LastVisited presence={presence} />
        </Stat>
      </dl>

      {session?.user?.isModerator ? (
        <ModeratorWarnings userId={user.id} />
      ) : null}

      <div className="border-t p-4">
        <Link
          className={cn(buttonVariants({ size: "sm" }), "w-full")}
          to={href}
        >
          {t("view_profile")}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
};

const PreviewBody = ({
  nameCode,
  surface,
}: {
  nameCode: string;
  surface: UserPreviewSurface;
}) => {
  const t = useTranslations("core.profile");
  const query = useQuery(userProfileQueryOptions({ nameCode }));
  const [replacesSkeleton] = React.useState(query.isPending);
  const title =
    surface === "sheet" ? (
      <DrawerTitle className="sr-only">
        {t("preview.sheet_title", { nameCode })}
      </DrawerTitle>
    ) : null;

  if (query.isPending) {
    return (
      <>
        {title}
        <UserPreviewSkeleton />
      </>
    );
  }

  if (query.isError) {
    const notFound = isProfileNotFound(query.error);

    return (
      <>
        {title}
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
      </>
    );
  }

  return (
    <>
      {title}
      <PreviewProfile fadeIn={replacesSkeleton} user={query.data} />
    </>
  );
};

/**
 * The user preview's content: loads its messages and the member's public
 * profile, showing a skeleton until both arrive. Moderators also get the
 * member's warning summary. Lazy-loaded by `UserPreview` when it opens.
 */
export const UserPreviewCard = ({
  nameCode,
  surface = "card",
}: {
  nameCode: string;
  surface?: UserPreviewSurface;
}) => (
  <RouteMessages namespaces={USER_PREVIEW_NAMESPACES}>
    <PreviewBody nameCode={nameCode} surface={surface} />
  </RouteMessages>
);
