import type { ContentLabelTranslator } from "@vitnode/api/content/admin/labels";

import {
  useQueryErrorResetBoundary,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import { contentTypeName } from "@vitnode/api/content/admin/labels";
import { cn } from "cn";
import {
  FileTextIcon,
  LayoutListIcon,
  NotebookPenIcon,
  RotateCwIcon,
  SearchXIcon,
} from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import type { ProfileContentStats } from "@/views/profile/profile-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import { userProfileContentHref } from "@/components/user-profile-href";
import { profileContentQueryOptions } from "@/views/profile/profile-content-query";
import { getSearchTypeRenderer } from "@/views/search/registry";
import { SearchFeedList } from "@/views/search/search-feed-content";
import { SearchTimelineSkeleton } from "@/views/search/search-timeline-skeleton";

import { useLocale } from "../i18n/locale";
import { RouteMessages } from "../i18n/route-messages";
import { HrefLink } from "../link/href-link";
import { profileContentNamespaces } from "./route";

/** Labels the filter chips by the content types' own plugin messages. */
const useTypeLabel = () => {
  const t = useTranslations() as unknown as ContentLabelTranslator;

  return (type: { id: string; label: string }) =>
    t.has(type.label) ? t(type.label, { count: 2 }) : contentTypeName(type.id);
};

interface ContentFilter {
  count: number;
  id: null | string;
  label: string;
}

const FilterChip = ({
  active,
  filter,
  href,
}: {
  active: boolean;
  filter: ContentFilter;
  href: string;
}) => {
  const format = useFormatter();
  const Icon =
    filter.id === null ? LayoutListIcon : getSearchTypeRenderer(filter.id).icon;

  return (
    <li className="shrink-0">
      <HrefLink
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 motion-safe:transition-colors",
          active
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground hover:bg-muted",
        )}
        href={href}
        resetScroll={false}
      >
        <Icon aria-hidden="true" className="size-4" />
        {filter.label}
        <span
          className={cn(
            "tabular-nums",
            active ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {format.number(filter.count)}
        </span>
      </HrefLink>
    </li>
  );
};

const ContentFilters = ({
  nameCode,
  selected,
  stats,
}: {
  nameCode: string;
  selected: null | string;
  stats: ProfileContentStats;
}) => {
  const t = useTranslations("core.profile.content");
  const typeLabel = useTypeLabel();
  const filters: ContentFilter[] = [
    { count: stats.total, id: null, label: t("all") },
    ...stats.types
      .filter(type => (stats.byType[type.id] ?? 0) > 0 || type.id === selected)
      .map(type => ({
        count: stats.byType[type.id] ?? 0,
        id: type.id,
        label: typeLabel(type),
      })),
  ];

  return (
    <nav aria-label={t("filters")}>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {filters.map(filter => (
          <FilterChip
            active={filter.id === selected}
            filter={filter}
            href={userProfileContentHref(nameCode, filter.id)}
            key={filter.id ?? "all"}
          />
        ))}
      </ul>
    </nav>
  );
};

/** The tab while its messages load: chips, then timeline rows. */
export const ProfileContentTabSkeleton = () => (
  <div className="flex flex-col gap-4">
    <div aria-hidden="true" className="flex gap-2">
      {["w-20", "w-28", "w-32"].map(width => (
        <Skeleton className={cn("h-9 rounded-full", width)} key={width} />
      ))}
    </div>
    <SearchTimelineSkeleton />
  </div>
);

const ContentEmpty = ({
  nameCode,
  selected,
}: {
  nameCode: string;
  selected: null | { id: string; label: string };
}) => {
  const t = useTranslations("core.profile.content");
  const typeLabel = useTypeLabel();

  if (!selected) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NotebookPenIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.desc", { nameCode })}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("empty_filter.title")}</EmptyTitle>
        <EmptyDescription>
          {t("empty_filter.desc", { nameCode, type: typeLabel(selected) })}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <HrefLink
          className={buttonVariants({ variant: "outline" })}
          href={userProfileContentHref(nameCode)}
          resetScroll={false}
        >
          <LayoutListIcon aria-hidden="true" />
          {t("empty_filter.show_all")}
        </HrefLink>
      </EmptyContent>
    </Empty>
  );
};

const ContentList = ({
  owner,
  selected,
}: {
  owner: SearchTimelineOwner & { nameCode: string };
  selected: null | { id: string; label: string };
}) => {
  const locale = useLocale();
  const query = useSuspenseInfiniteQuery(
    profileContentQueryOptions({
      locale,
      type: selected?.id ?? null,
      userId: owner.id,
    }),
  );

  if (query.data.pages[0]?.edges.length === 0) {
    return <ContentEmpty nameCode={owner.nameCode} selected={selected} />;
  }

  return <SearchFeedList owner={owner} query={query} variant="timeline" />;
};

const ContentError = ({ reset }: { reset: () => void }) => {
  const t = useTranslations("core.profile.content.load_error");
  const tErrors = useTranslations("core.global.errors");
  const { reset: resetQueries } = useQueryErrorResetBoundary();

  return (
    <Empty className="border" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon aria-hidden="true" />
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

/**
 * A profile's Content tab: what the member authored, newest first, with one
 * filter chip per content type that has any (plus the selected one). Counts
 * come from the profile payload; the list from the guest-scoped
 * `kind=content` timeline. A filter switch keeps the current list, dimmed,
 * until the next one is ready.
 */
export const ProfileContentTab = ({
  owner,
  stats,
  type,
}: {
  owner: SearchTimelineOwner & { nameCode: string };
  stats: ProfileContentStats;
  /** The selected filter, already checked against `stats.types`. */
  type: null | string;
}) => {
  const deferredType = React.useDeferredValue(type);
  const isSwitching = deferredType !== type;
  const selected =
    stats.types.find(candidate => candidate.id === deferredType) ?? null;
  const namespaces = profileContentNamespaces(stats);

  return (
    <RouteMessages namespaces={namespaces}>
      <div className="flex flex-col gap-4">
        <ContentFilters
          nameCode={owner.nameCode}
          selected={type}
          stats={stats}
        />
        <CatchBoundary
          errorComponent={ContentError}
          getResetKey={() => `${owner.id}:${deferredType ?? "all"}`}
        >
          <React.Suspense fallback={<SearchTimelineSkeleton />}>
            <div
              aria-busy={isSwitching}
              className={cn(
                "motion-safe:transition-opacity",
                isSwitching && "opacity-60",
              )}
            >
              <ContentList owner={owner} selected={selected} />
            </div>
          </React.Suspense>
        </CatchBoundary>
      </div>
    </RouteMessages>
  );
};
