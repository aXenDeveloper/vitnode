import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import React from "react";
import {
  useFormatter,
  useLocale,
  useNow,
  useTimeZone,
  useTranslations,
} from "use-intl";
import { z } from "zod";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { HiddenIcon } from "@/components/hidden-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { UserFormat, userProfileHref } from "@/components/user-format";
import { getIntlRuntime } from "@/tanstack/i18n/runtime";
import { reactionTitle } from "@/tanstack/reactions/query";
import { ReactionIcon } from "@/tanstack/reactions/reaction-icon";

import type { SearchActivityKey } from "./registry";
import type { SearchFeedQueryOptions } from "./search-feed-query";
import type {
  SearchFeedPage,
  SearchResultAuthor,
  SearchResultItem,
  SearchTimelineEntry,
  SearchTimelineOwner,
  SearchTimelineReactionEntry,
} from "./types";

import { getSearchTypeRenderer } from "./registry";
import {
  SearchHighlightContext,
  searchHighlightPattern,
  searchHighlightWords,
  searchSnippetAround,
  useSearchHighlight,
} from "./search-highlight";
import { SearchHighlightText } from "./search-highlight-text";
import { SearchTimelineSkeleton } from "./search-timeline-skeleton";
import {
  groupTimelineReactions,
  isTimelineReactionGroup,
  TIMELINE_GROUP_VISIBLE_ITEMS,
  type TimelineReactionGroup,
  type TimelineRow,
} from "./timeline-reaction-groups";
import { isSearchTimelineReaction } from "./types";

const SNIPPET_LENGTH = 240;

export type SearchFeedVariant = "list" | "timeline";

export type {
  SearchFeedParams,
  SearchFeedQueryOptions,
} from "./search-feed-query";
export { searchFeedQueryKey } from "./search-feed-query";

export interface SearchFeedLinkProps {
  children: React.ReactNode;
  className?: string;
  href: string;
}

const useSnippet = (content: string): string =>
  searchSnippetAround(content, useSearchHighlight(), SNIPPET_LENGTH);

const Highlight = ({ text }: { text: string }) => (
  <SearchHighlightText pattern={useSearchHighlight()} text={text} />
);

/**
 * The schemes a search result is allowed to link to.
 *
 * An allowlist rather than a denylist, and that direction is the whole point. A
 * search document's `url` is written by whichever plugin indexed it, so this is
 * data, not code - and the previous rule ("anything with a scheme is external,
 * render it in an `<a href>`") happily passed `javascript:` and
 * `data:text/html,...` straight through. React 19 blocks `javascript:` at
 * render, but that is React's backstop, not this component's policy, and it
 * covers neither `data:` nor whatever the next scheme turns out to be.
 *
 * `mailto:` and `tel:` are here because a plugin indexing a contact record has
 * a real reason to emit them. Anything outside this set is refused.
 */
const SAFE_EXTERNAL_SCHEMES: ReadonlySet<string> = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);

/**
 * Control characters and spaces removed, because they hide a scheme:
 * `java\nscript:` and `\u0000javascript:` are both followed by a browser.
 *
 * Written as a code-point filter rather than a regular expression: a character
 * class containing a literal NUL is what `no-control-regex` exists to catch,
 * and the intent - "drop anything at or below a space" - reads better this way.
 */
const withoutControlCharacters = (value: string): string =>
  [...value].filter(char => (char.codePointAt(0) ?? 0) > 0x20).join("");

export type SearchFeedHrefKind = "external" | "internal" | "unsafe";

/**
 * What kind of destination an indexed `url` is.
 *
 * - `internal` - a path this app routes. The router's `Link` gets it.
 * - `external` - an allowlisted scheme, or a protocol-relative `//host/path`
 *   (kept because it is existing behaviour). A bare `<a>` gets it; no router
 *   would accept it anyway.
 * - `unsafe` - everything else. Nothing gets it: {@link ResultLink} renders the
 *   title as text. A result that cannot be linked to safely is still a result.
 *
 * Exported for the tests, which is the only way to state the policy directly
 * rather than through rendered markup.
 */
export const classifySearchFeedHref = (href: string): SearchFeedHrefKind => {
  const cleaned = withoutControlCharacters(href);

  // Protocol-relative. Checked before the scheme test, which would not match it.
  if (cleaned.startsWith("//")) return "external";
  // A path, absolute or relative - no scheme to vet.
  if (!/^[a-z][a-z\d+\-.]*:/i.test(cleaned)) return "internal";

  const scheme = cleaned.slice(0, cleaned.indexOf(":") + 1).toLowerCase();

  return SAFE_EXTERNAL_SCHEMES.has(scheme) ? "external" : "unsafe";
};

/**
 * Whether an internal href is a URL of another language than the page's, such
 * as a Polish-only article on an English profile. The router would rewrite it
 * into the current language, so it is followed as a plain link instead.
 */
const isOtherLocaleHref = (href: string, locale: string): boolean => {
  try {
    const { pathname } = new URL(href, "https://vitnode.invalid");

    return getIntlRuntime().localeRouting.resolveLocale(pathname) !== locale;
  } catch {
    return false;
  }
};

const ResultLink = ({ children, className, href }: SearchFeedLinkProps) => {
  const kind = classifySearchFeedHref(href);
  const locale = useLocale();

  if (kind === "unsafe") return <span className={className}>{children}</span>;

  if (kind === "external" || isOtherLocaleHref(href, locale)) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href} to={href}>
      {children}
    </Link>
  );
};

const ItemTitle = ({ item }: { item: SearchResultItem }) =>
  item.url ? (
    <ResultLink className="hover:underline" href={item.url}>
      <Highlight text={item.title} />
    </ResultLink>
  ) : (
    <Highlight text={item.title} />
  );

const ItemHiddenIcon = ({
  className,
  focusable,
  item,
}: {
  className?: string;
  focusable?: boolean;
  item: SearchResultItem;
}) => {
  const t = useTranslations("core.search");
  if (!item.isHidden) return null;

  return (
    <HiddenIcon
      className={className}
      focusable={focusable}
      label={t("hidden", {
        type: t(getSearchTypeRenderer(item.itemType, item.metadata).labelKey),
      })}
    />
  );
};

const MAX_SHOWN_AUTHORS = 3;

const authorsOf = (item: SearchResultItem): SearchResultAuthor[] =>
  item.authors.length > 0 ? item.authors : item.author ? [item.author] : [];

const AuthorNames = ({ authors }: { authors: SearchResultAuthor[] }) => {
  const t = useTranslations("core.search");
  const format = useFormatter();
  const shown =
    authors.length > MAX_SHOWN_AUTHORS
      ? authors.slice(0, MAX_SHOWN_AUTHORS - 1)
      : authors;
  const rest = authors.length - shown.length;

  return (
    <span className="text-foreground font-medium">
      {format.list([
        ...shown.map(author => author.name),
        ...(rest > 0 ? [t("more_authors", { count: rest })] : []),
      ])}
    </span>
  );
};

const AuthorAvatars = ({ authors }: { authors: SearchResultAuthor[] }) => (
  <span aria-hidden className="flex shrink-0 items-center">
    {authors.slice(0, MAX_SHOWN_AUTHORS).map((author, index) => (
      <Avatar
        alt=""
        className={cn("ring-background ring-2", index > 0 && "-ms-1.5")}
        key={author.id}
        size={20}
        user={author}
      />
    ))}
  </span>
);

const ResultImage = ({ image }: { image: SearchResultItem["image"] }) =>
  image ? (
    <img
      alt=""
      className="bg-muted aspect-video w-full shrink-0 rounded-md object-cover sm:w-40"
      decoding="async"
      height={image.height}
      loading="lazy"
      src={image.url}
      width={image.width}
    />
  ) : null;

const zodActivityContext = z.object({
  context: z.object({ title: z.string().min(1), url: z.string().nullable() }),
});

interface SearchActivity {
  context: { title: string; url: null | string };
  key: SearchActivityKey;
}

const activityOf = (item: SearchResultItem): null | SearchActivity => {
  const { activityKey } = getSearchTypeRenderer(item.itemType, item.metadata);
  if (!activityKey) return null;

  const parsed = zodActivityContext.safeParse(item.metadata);

  return parsed.success
    ? { context: parsed.data.context, key: activityKey }
    : null;
};

const ActivityLink = ({
  children,
  href,
}: {
  children: React.ReactNode;
  href: null | string;
}) =>
  href ? (
    <ResultLink
      className="text-foreground relative z-10 font-medium hover:underline"
      href={href}
    >
      {children}
    </ResultLink>
  ) : (
    <span className="text-foreground font-medium">{children}</span>
  );

const CARD_OVERLAY_LINK =
  "after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";

const ActivitySentence = ({
  activity,
  authors,
  item,
}: {
  activity: SearchActivity;
  authors: SearchResultAuthor[];
  item: SearchResultItem;
}) => {
  const t = useTranslations("core.search");
  const format = useFormatter();
  const [onlyAuthor] = authors.length === 1 ? authors : [];

  return (
    <span className="min-w-0 text-pretty">
      {t.rich(activity.key, {
        author: format.list(authors.map(author => author.name)),
        context: activity.context.title,
        item: item.title,
        link: chunks => <ActivityLink href={item.url}>{chunks}</ActivityLink>,
        profile: chunks => (
          <ActivityLink
            href={onlyAuthor ? userProfileHref(onlyAuthor.nameCode) : null}
          >
            {chunks}
          </ActivityLink>
        ),
        target: () => (
          <ActivityLink href={activity.context.url}>
            <Highlight text={activity.context.title} />
          </ActivityLink>
        ),
      })}
    </span>
  );
};

const ActivityBody = ({
  className,
  item,
  overlayClassName = CARD_OVERLAY_LINK,
  snippet,
}: {
  className?: string;
  item: SearchResultItem;
  overlayClassName?: string;
  snippet: string;
}) => {
  if (item.url && !snippet) {
    return (
      <ResultLink className={overlayClassName} href={item.url}>
        <span className="sr-only">{item.title}</span>
      </ResultLink>
    );
  }
  if (!snippet) return null;

  return item.url ? (
    <ResultLink
      className={cn(
        "text-foreground leading-relaxed",
        overlayClassName,
        className,
      )}
      href={item.url}
    >
      <Highlight text={snippet} />
    </ResultLink>
  ) : (
    <p className={cn("text-foreground leading-relaxed", className)}>
      <Highlight text={snippet} />
    </p>
  );
};

const DraftBadge = () => {
  const t = useTranslations("core.search");

  return <Badge variant="warning">{t("draft")}</Badge>;
};

const DAY_MS = 86_400_000;

const SURFACE = "bg-card rounded-xl shadow-xs ring-1 ring-foreground/8";

const CARD_OVERLAY_LINK_XL =
  "after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";

const dateOf = (item: SearchTimelineEntry): Date =>
  typeof item.createdAt === "string"
    ? new Date(item.createdAt)
    : item.createdAt;

const useDayKey = () => {
  const timeZone = useTimeZone();
  const formatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        month: "2-digit",
        timeZone,
        year: "numeric",
      }),
    [timeZone],
  );

  return (date: Date) => formatter.format(date);
};

const dayKeyDate = (key: string) =>
  new Date(`${key.length === 7 ? `${key}-15` : key}T12:00:00Z`);

const groupConsecutive = <T,>(
  items: readonly T[],
  keyOf: (item: T) => string,
) => {
  const groups: { items: T[]; key: string }[] = [];

  for (const item of items) {
    const key = keyOf(item);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ items: [item], key });
  }

  return groups;
};

const useDayHeading = (todayKey: string) => {
  const locale = useLocale();
  const format = useFormatter();

  return (key: string) => {
    const diff = Math.round(
      (dayKeyDate(todayKey).getTime() - dayKeyDate(key).getTime()) / DAY_MS,
    );

    if (diff === 0 || diff === 1) {
      const word = new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
      }).format(-diff, "day");

      return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
    }

    return format.dateTime(dayKeyDate(key), {
      day: "numeric",
      month: "long",
      weekday: "long",
    });
  };
};

const DayTile = ({ date, isToday }: { date: Date; isToday: boolean }) => {
  const format = useFormatter();

  return (
    <time
      className={cn(
        "bg-card flex w-12 shrink-0 flex-col items-center rounded-xl pt-1.5 pb-1 shadow-sm",
        isToday
          ? "ring-destructive/60 z-10 ring-2"
          : "ring-foreground/8 ring-1",
      )}
      dateTime={date.toISOString().slice(0, 10)}
    >
      <span
        className={cn(
          "text-xs leading-none font-semibold tracking-wide uppercase",
          FEEDBACK_TONE_TEXT.destructive,
        )}
      >
        {format.dateTime(date, { weekday: "short" })}
      </span>
      <span className="text-foreground text-2xl leading-tight font-medium tabular-nums">
        {format.dateTime(date, { day: "numeric" })}
      </span>
    </time>
  );
};

type TimelineReaction = SearchTimelineReactionEntry["reaction"];

const ReactionRailNode = ({ reaction }: { reaction: TimelineReaction }) => {
  const locale = useLocale();

  return (
    <TooltipWithContent text={reactionTitle(reaction, locale)}>
      <span className="bg-card ring-foreground/8 flex size-9 shrink-0 items-center justify-center rounded-full shadow-xs ring-1">
        <ReactionIcon className="size-4" reaction={reaction} />
      </span>
    </TooltipWithContent>
  );
};

const ReactionTitle = ({ reaction }: { reaction: TimelineReaction }) => {
  const locale = useLocale();

  return <span className="sr-only">{reactionTitle(reaction, locale)}: </span>;
};

const ReactionOwner = ({ owner }: { owner?: SearchTimelineOwner }) =>
  owner ? (
    <UserFormat className="relative z-10" format link user={owner} />
  ) : null;

const REACTION_LINE =
  "text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 py-1.5 text-sm leading-relaxed";
const REACTION_TARGET_LINK =
  "text-foreground font-medium underline-offset-4 hover:underline";

const ReactionCard = ({
  entry,
  owner,
}: {
  entry: SearchTimelineReactionEntry;
  owner?: SearchTimelineOwner;
}) => {
  const t = useTranslations("core.reactions.timeline");

  return (
    <article className={REACTION_LINE}>
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5">
        <ReactionTitle reaction={entry.reaction} />
        {t.rich("reacted", {
          target: chunks => (
            <ResultLink
              className={REACTION_TARGET_LINK}
              href={entry.target.url}
            >
              {chunks}
            </ResultLink>
          ),
          title: entry.target.title,
          user: () => <ReactionOwner owner={owner} />,
        })}
      </p>
      <span aria-hidden="true">·</span>
      <DateFormat date={entry.createdAt} />
    </article>
  );
};

const ReactionGroupCard = ({
  group,
  owner,
}: {
  group: TimelineReactionGroup;
  owner?: SearchTimelineOwner;
}) => {
  const t = useTranslations("core.reactions.timeline");
  const visible = group.entries.slice(0, TIMELINE_GROUP_VISIBLE_ITEMS);
  const hidden = group.entries.length - visible.length;

  return (
    <article className="flex min-w-0 flex-1 flex-col">
      <div className={REACTION_LINE}>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          <ReactionTitle reaction={group.reaction} />
          {t.rich("reacted_in", {
            count: group.entries.length,
            kind: group.targetKind,
            target: chunks => (
              <ActivityLink href={group.context.url}>{chunks}</ActivityLink>
            ),
            title: group.context.title,
            user: () => <ReactionOwner owner={owner} />,
          })}
        </p>
        <span aria-hidden="true">·</span>
        <DateFormat date={group.createdAt} />
      </div>
      <ol className="flex flex-col gap-1 pb-2">
        {visible.map(entry => (
          <li
            className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm leading-relaxed"
            key={entryKey(entry)}
          >
            <ResultLink
              className={cn(REACTION_TARGET_LINK, "min-w-0 truncate")}
              href={entry.target.url}
            >
              {entry.target.title}
            </ResultLink>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              <DateFormat date={entry.createdAt} />
            </span>
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <p className="text-muted-foreground pb-2 text-sm leading-relaxed">
          {t("more", { count: hidden })}
        </p>
      )}
    </article>
  );
};

const RailNode = ({ item }: { item: SearchResultItem }) => {
  const t = useTranslations("core.search");
  const renderer = getSearchTypeRenderer(item.itemType, item.metadata);
  const Icon = renderer.icon;

  return (
    <TooltipWithContent text={t(renderer.labelKey)}>
      <span className="bg-card text-muted-foreground ring-foreground/8 flex size-9 shrink-0 items-center justify-center rounded-full shadow-xs ring-1">
        <Icon aria-hidden className="size-4" />
      </span>
    </TooltipWithContent>
  );
};

const CardMeta = ({
  children,
  item,
}: {
  children?: React.ReactNode;
  item: SearchResultItem;
}) => {
  const t = useTranslations("core.search");

  return (
    <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="text-foreground font-medium">
        {t(getSearchTypeRenderer(item.itemType, item.metadata).labelKey)}
      </span>
      {children}
      <DateFormat date={item.createdAt} />
      <ItemHiddenIcon className="relative z-10 size-4" focusable item={item} />
      {!item.isPublic && !item.isHidden && <DraftBadge />}
    </div>
  );
};

const CardTitle = ({
  className,
  item,
}: {
  className: string;
  item: SearchResultItem;
}) => (
  <h3 className={cn("text-foreground leading-snug font-semibold", className)}>
    {item.url ? (
      <ResultLink className={CARD_OVERLAY_LINK_XL} href={item.url}>
        <Highlight text={item.title} />
      </ResultLink>
    ) : (
      <Highlight text={item.title} />
    )}
  </h3>
);

const visibleAuthorsOf = (
  item: SearchResultItem,
  ownerId?: number,
): SearchResultAuthor[] => {
  const authors = authorsOf(item);
  const [only] = authors;

  return ownerId !== undefined && authors.length === 1 && only?.id === ownerId
    ? []
    : authors;
};

const AuthorLine = ({
  authors,
  children,
}: {
  authors: SearchResultAuthor[];
  children: React.ReactNode;
}) => (
  <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
    {authors.length > 0 && <AuthorAvatars authors={authors} />}
    <p className="line-clamp-2 min-w-0">{children}</p>
  </div>
);

const onlyAuthorHref = (authors: SearchResultAuthor[]): null | string => {
  const [only] = authors;

  return authors.length === 1 && only ? userProfileHref(only.nameCode) : null;
};

const cardSurface = (item: SearchResultItem, className: string) =>
  cn(
    SURFACE,
    "relative min-w-0 flex-1",
    item.url && "hover:ring-foreground/15 transition-shadow",
    item.isHidden && "opacity-70",
    className,
  );

const ArticleCard = ({
  item,
  ownerId,
}: {
  item: SearchResultItem;
  ownerId?: number;
}) => {
  const snippet = useSnippet(item.content);
  const authors = visibleAuthorsOf(item, ownerId);
  const profileHref = onlyAuthorHref(authors);

  return (
    <article className={cardSurface(item, "flex flex-col overflow-hidden")}>
      {item.image && (
        <img
          alt=""
          className="bg-muted h-32 w-full object-cover sm:h-44"
          decoding="async"
          height={item.image.height}
          loading="lazy"
          src={item.image.url}
          width={item.image.width}
        />
      )}
      <div className="flex flex-col gap-2 p-4 sm:p-5">
        <CardMeta item={item} />
        {authors.length > 0 && (
          <AuthorLine authors={authors}>
            {profileHref ? (
              <ActivityLink href={profileHref}>{authors[0]?.name}</ActivityLink>
            ) : (
              <AuthorNames authors={authors} />
            )}
          </AuthorLine>
        )}
        <CardTitle className="text-xl text-balance" item={item} />
        {snippet && (
          <p className="text-muted-foreground line-clamp-3 leading-relaxed text-pretty">
            <Highlight text={snippet} />
          </p>
        )}
      </div>
    </article>
  );
};

const TopicCard = ({
  activity,
  item,
  ownerId,
}: {
  activity: SearchActivity;
  item: SearchResultItem;
  ownerId?: number;
}) => {
  const t = useTranslations("core.search");
  const format = useFormatter();
  const snippet = useSnippet(item.content);
  const authors = visibleAuthorsOf(item, ownerId);
  const target = (chunks: React.ReactNode) => (
    <ActivityLink href={activity.context.url}>{chunks}</ActivityLink>
  );

  return (
    <article className={cardSurface(item, "flex gap-4 p-4")}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <CardMeta item={item} />
        <AuthorLine authors={authors}>
          {authors.length > 0
            ? t.rich("timeline.posted_in", {
                author: format.list(authors.map(author => author.name)),
                context: activity.context.title,
                profile: chunks => (
                  <ActivityLink href={onlyAuthorHref(authors)}>
                    {chunks}
                  </ActivityLink>
                ),
                target,
              })
            : t.rich("timeline.posted_in_self", {
                context: activity.context.title,
                target,
              })}
        </AuthorLine>
        <CardTitle className="text-lg text-pretty" item={item} />
        {snippet && (
          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            <Highlight text={snippet} />
          </p>
        )}
      </div>
      {item.image && (
        <img
          alt=""
          className="bg-muted size-14 shrink-0 rounded-lg object-cover outline-1 -outline-offset-1 outline-black/10 sm:h-24 sm:w-32 dark:outline-white/10"
          decoding="async"
          loading="lazy"
          src={item.image.url}
        />
      )}
    </article>
  );
};

const CommentCard = ({
  activity,
  item,
  ownerId,
}: {
  activity: SearchActivity;
  item: SearchResultItem;
  ownerId?: number;
}) => {
  const t = useTranslations("core.search");
  const snippet = useSnippet(item.content);
  const authors = visibleAuthorsOf(item, ownerId);

  return (
    <article className={cardSurface(item, "flex flex-col gap-2 p-4")}>
      <CardMeta item={item} />
      <AuthorLine authors={authors}>
        {authors.length > 0 ? (
          <ActivitySentence activity={activity} authors={authors} item={item} />
        ) : (
          t.rich("activity.commented_self", {
            context: activity.context.title,
            target: chunks => (
              <ActivityLink href={activity.context.url}>{chunks}</ActivityLink>
            ),
          })
        )}
      </AuthorLine>
      {snippet ? (
        <div className="border-border border-s-2 ps-3">
          <ActivityBody
            className="line-clamp-3"
            item={item}
            overlayClassName={CARD_OVERLAY_LINK_XL}
            snippet={snippet}
          />
        </div>
      ) : (
        <ActivityBody
          item={item}
          overlayClassName={CARD_OVERLAY_LINK_XL}
          snippet={snippet}
        />
      )}
    </article>
  );
};

const TimelineCard = ({
  item,
  ownerId,
}: {
  item: SearchResultItem;
  ownerId?: number;
}) => {
  const activity = activityOf(item);

  if (activity?.key === "activity.commented") {
    return <CommentCard activity={activity} item={item} ownerId={ownerId} />;
  }
  if (activity) {
    return <TopicCard activity={activity} item={item} ownerId={ownerId} />;
  }

  return <ArticleCard item={item} ownerId={ownerId} />;
};

const entryKey = (entry: SearchTimelineEntry): string =>
  isSearchTimelineReaction(entry)
    ? `reaction-${entry.target.pluginId}-${entry.target.type}-${entry.target.id}-${entry.reaction.code}`
    : `${entry.itemType}-${entry.itemId}`;

const rowKey = (row: TimelineRow): string =>
  isTimelineReactionGroup(row)
    ? `group-${row.entries.map(entryKey).join("|")}`
    : entryKey(row);

const SearchTimeline = ({
  items,
  owner,
}: {
  items: SearchTimelineEntry[];
  owner?: SearchTimelineOwner;
}) => {
  const t = useTranslations("core.search");
  const format = useFormatter();
  const dayKey = useDayKey();
  const todayKey = dayKey(useNow({ updateInterval: 60_000 }));
  const dayHeading = useDayHeading(todayKey);
  const months = groupConsecutive(items, item =>
    dayKey(dateOf(item)).slice(0, 7),
  );

  return (
    <div className="flex flex-col gap-10">
      {months.map((month, monthIndex) => {
        const days = groupConsecutive(month.items, item =>
          dayKey(dateOf(item)),
        );
        const headingId = `search-month-${month.key}`;

        return (
          <section
            aria-labelledby={headingId}
            className="flex flex-col gap-4"
            key={month.key}
          >
            <h2 className="text-xl font-semibold" id={headingId}>
              {format.dateTime(dayKeyDate(month.key), {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <ol className="flex flex-col">
              {days.map((day, dayIndex) => (
                <li className="flex flex-col" key={day.key}>
                  <div className="flex gap-3 sm:gap-4">
                    <div className="flex w-12 shrink-0 flex-col items-center">
                      {dayIndex > 0 && (
                        <span aria-hidden className="bg-border h-4 w-px" />
                      )}
                      <DayTile
                        date={dayKeyDate(day.key)}
                        isToday={day.key === todayKey}
                      />
                    </div>
                    <p
                      className={cn(
                        "flex items-center gap-2 text-sm",
                        dayIndex > 0 && "pt-4",
                      )}
                    >
                      <span className="text-foreground font-medium">
                        {dayHeading(day.key)}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        · {t("timeline.items", { count: day.items.length })}
                      </span>
                    </p>
                  </div>
                  <ol className="flex flex-col">
                    {groupTimelineReactions(day.items).map(
                      (item, itemIndex, rows) => {
                        const isLast =
                          monthIndex === months.length - 1 &&
                          dayIndex === days.length - 1 &&
                          itemIndex === rows.length - 1;

                        return (
                          <li
                            className="flex gap-3 sm:gap-4"
                            key={rowKey(item)}
                          >
                            <div className="flex w-12 shrink-0 flex-col items-center">
                              <span
                                aria-hidden
                                className="bg-border h-4 w-px"
                              />
                              {isTimelineReactionGroup(item) ||
                              isSearchTimelineReaction(item) ? (
                                <ReactionRailNode reaction={item.reaction} />
                              ) : (
                                <RailNode item={item} />
                              )}
                              {!isLast && (
                                <span
                                  aria-hidden
                                  className="bg-border w-px grow"
                                />
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 pt-4">
                              {isTimelineReactionGroup(item) ? (
                                <ReactionGroupCard group={item} owner={owner} />
                              ) : isSearchTimelineReaction(item) ? (
                                <ReactionCard entry={item} owner={owner} />
                              ) : (
                                <TimelineCard item={item} ownerId={owner?.id} />
                              )}
                            </div>
                          </li>
                        );
                      },
                    )}
                  </ol>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
};

const SearchResultCard = ({ item }: { item: SearchResultItem }) => {
  const t = useTranslations("core.search");
  const renderer = getSearchTypeRenderer(item.itemType, item.metadata);
  const Icon = renderer.icon;
  const snippet = useSnippet(item.content);
  const authors = authorsOf(item);
  const activity = activityOf(item);

  return (
    <Card
      className={cn(
        activity && item.url && "hover:bg-muted/50 relative transition-colors",
      )}
    >
      <CardContent className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          {item.author ? (
            <Avatar size={40} user={item.author} />
          ) : (
            <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
              <Icon className="size-5" />
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
              <span className="bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5">
                <Icon className="size-3.5" />
                {t(renderer.labelKey)}
              </span>
              {activity ? (
                <ActivitySentence
                  activity={activity}
                  authors={authors}
                  item={item}
                />
              ) : (
                authors.length > 0 && <AuthorNames authors={authors} />
              )}
              <DateFormat date={item.createdAt} />
              {!item.isPublic && !item.isHidden && <DraftBadge />}
            </div>

            {activity ? (
              <ActivityBody
                className="line-clamp-3 text-sm"
                item={item}
                snippet={snippet}
              />
            ) : (
              <>
                <h3 className="text-foreground flex min-w-0 items-center gap-2 text-lg font-semibold">
                  <ItemHiddenIcon className="size-4" item={item} />
                  <span className="truncate">
                    <ItemTitle item={item} />
                  </span>
                </h3>

                {snippet && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    <Highlight text={snippet} />
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <ResultImage image={item.image} />
      </CardContent>
    </Card>
  );
};

export interface SearchFeedListQuery {
  data?: {
    pages: readonly (
      | SearchFeedPage
      | { edges: readonly SearchTimelineEntry[] }
    )[];
  };
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
}

export const SearchFeedList = ({
  highlight,
  owner,
  query: { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading },
  variant = "list",
}: {
  highlight?: string;
  owner?: SearchTimelineOwner;
  query: SearchFeedListQuery;
  variant?: SearchFeedVariant;
}) => {
  const t = useTranslations("core.search");
  const pattern = React.useMemo(
    () => searchHighlightPattern(searchHighlightWords(highlight)),
    [highlight],
  );
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const entries: SearchTimelineEntry[] =
    data?.pages.flatMap(page => [...page.edges]) ?? [];
  const items = entries.filter(
    (entry): entry is SearchResultItem => !isSearchTimelineReaction(entry),
  );

  if (isLoading) {
    return variant === "timeline" ? (
      <SearchTimelineSkeleton />
    ) : (
      <div className="flex flex-col gap-3">
        {["a", "b", "c"].map(id => (
          <Skeleton className="h-24 w-full rounded-xl" key={id} />
        ))}
      </div>
    );
  }

  if ((variant === "timeline" ? entries : items).length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center">{t("empty")}</p>
    );
  }

  const loadMore = (
    <>
      <div ref={sentinelRef} />

      {hasNextPage && (
        <Button
          className="mx-auto"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
          variant="outline"
        >
          {isFetchingNextPage ? t("loading") : t("loadMore")}
        </Button>
      )}
    </>
  );

  if (variant === "timeline") {
    return (
      <SearchHighlightContext value={pattern}>
        <div className="flex flex-col gap-6">
          <SearchTimeline items={entries} owner={owner} />
          {loadMore}
        </div>
      </SearchHighlightContext>
    );
  }

  return (
    <SearchHighlightContext value={pattern}>
      <div className="flex flex-col gap-3">
        {items.map(item => (
          <SearchResultCard
            item={item}
            key={`${item.itemType}-${item.itemId}`}
          />
        ))}

        {loadMore}
      </div>
    </SearchHighlightContext>
  );
};

export const SearchFeedContent = ({
  queryOptions,
  variant = "list",
}: {
  queryOptions: SearchFeedQueryOptions;
  variant?: SearchFeedVariant;
}) => {
  const query = useInfiniteQuery(queryOptions);

  return <SearchFeedList query={query} variant={variant} />;
};
