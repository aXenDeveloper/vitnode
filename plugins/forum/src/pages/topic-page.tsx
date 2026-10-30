import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { queryOptions } from "@tanstack/react-query";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@vitnode/core/components/ui/breadcrumb";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  contentTarget,
  richTextToPlainText,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import {
  ContentAccessRequired,
  contentPageItem,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { localeAlternateLinks } from "@vitnode/core/tanstack/metadata";
import { ReportButton } from "@vitnode/core/tanstack/moderation";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { useRecordView } from "@vitnode/core/tanstack/search";
import { PencilIcon } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { topicContentType } from "@/content/topic";
import { manifest } from "@/manifest.gen";

import type { ForumPerson } from "./forum-data";
import type { TopicSearch } from "./forum-links";

import { zodPerson } from "./forum-data";
import {
  FORUM_HREF,
  forumHref,
  topicEditHref,
  topicHref,
  topicNewHref,
} from "./forum-links";
import { useTopicPermissions } from "./forum-permissions";
import {
  forumQueryKeys,
  isSharedResponse,
  queryForum,
  threadQueryOptions,
  TOPIC_STALE_TIME,
} from "./forum-queries";
import { PersonAvatar, PersonName, TimeAgo } from "./forum-ui";
import { ForumThread } from "./thread";

const DESCRIPTION_MAX_LENGTH = 160;

const zodTopic = z.object({
  author: zodPerson,
  body: zodRichTextDocument,
  createdAt: z.string(),
  forum: z.number(),
  id: z.number(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
  updatedAt: z.string(),
});

const excerptOf = (text: string): string => {
  if (text.length <= DESCRIPTION_MAX_LENGTH) return text;
  const cut = text.slice(0, DESCRIPTION_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const absoluteUrl = (path: string, base: string): string => {
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
};

const topicQueryOptions = (slug: string) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/topics",
        path: "/{slug}",
        args: { params: { slug: encodeURIComponent(slug) } },
      });

      if (res.status === 404) return { shared: false, topic: null };
      // In a forum the viewer may see but not read: no topic, only the fact.
      if (res.status === 403) {
        return { accessRequired: true as const, shared: false, topic: null };
      }
      if (res.status !== 200) {
        throw new Error(`Loading the topic "${slug}" failed.`);
      }

      return {
        shared: isSharedResponse(res),
        topic: zodTopic.parse(await res.json()),
      };
    },
    queryKey: forumQueryKeys.topic(slug),
    staleTime: ({ state }) => (state.data?.shared ? TOPIC_STALE_TIME : 0),
  });

const loadTopic = async (
  queryClient: QueryClient,
  { locale, slug }: { locale: string; slug: string },
) => {
  const loaded = await queryClient.query(topicQueryOptions(slug));
  if ("accessRequired" in loaded) return { accessRequired: true as const };
  const topic = contentPageItem(loaded.topic);

  const [forum, thread] = await Promise.all([
    queryForum(queryClient, String(topic.forum)).catch(() => null),
    queryClient.query(threadQueryOptions(topic.id)),
  ]);

  const trail = forum ? [...forum.ancestors, forum.container] : [];

  const path = topicHref(topic.slug);
  const canonicalUrl =
    localeAlternateLinks({ alternates: { [locale]: path }, locale }).find(
      link => link.rel === "canonical",
    )?.href ?? path;

  return {
    accessRequired: false as const,
    canComment: forum?.container.access.canComment ?? true,
    canonicalUrl,
    description: excerptOf(
      richTextToPlainText(topic.body).replace(/\s+/g, " "),
    ),
    locale,
    thread: thread ?? {
      items: [],
      pageInfo: { endCursor: null, hasNextPage: false, totalCount: 0 },
      commentCount: 0,
      truncated: false,
    },
    topic,
    trail: trail.map(({ id, name, slug: forumSlug }) => ({
      id,
      name,
      slug: forumSlug,
    })),
  };
};

type TopicPageData = Awaited<ReturnType<typeof loadTopic>>;

const ForumsCrumb = () => {
  const t = useTranslations("@vitnode/forum.forums");

  return <>{t("title")}</>;
};

export const route = defineRoute<TopicPageData, TopicSearch>({
  load: async ({ context, params }) =>
    await loadTopic(context.queryClient, {
      locale: context.locale,
      slug: params.slug,
    }),

  head: ({ loaderData, t }) =>
    !loaderData || loaderData.accessRequired
      ? {
          robots: "noindex, nofollow",
          title: t("@vitnode/forum.forums.access_required"),
        }
      : {
          alternates: {
            [loaderData.locale]: topicHref(loaderData.topic.slug),
          },
          description: loaderData.description,
          title: loaderData.topic.title,
        },

  breadcrumb: {
    group: ({ loaderData }) => (
      <>
        <BreadcrumbItem>
          <BreadcrumbLink render={<HrefLink href={FORUM_HREF} />}>
            <ForumsCrumb />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {(loaderData.accessRequired ? [] : loaderData.trail).map(forum => (
          <Fragment key={forum.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<HrefLink href={forumHref(forum.slug)} />}
              >
                {forum.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Fragment>
        ))}
        {loaderData.accessRequired ? null : (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{loaderData.topic.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </>
    ),
  },
});

/**
 * Asked in the browser, so a cached page stays shared: the Content Engine says
 * whether this visitor may edit or report the topic.
 */
const TopicViewerActions = ({
  author,
  title,
  topicId,
}: {
  author: ForumPerson;
  title: string;
  topicId: number;
}) => {
  const t = useTranslations("@vitnode/forum.topics.detail");
  const { canEdit, canReport } = useTopicPermissions([topicId]).of(topicId);

  return (
    <>
      {canEdit ? (
        <HrefLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={topicEditHref(topicId)}
        >
          <PencilIcon aria-hidden="true" />
          {t("edit")}
        </HrefLink>
      ) : null}
      {canReport ? (
        <ReportButton
          className="text-muted-foreground"
          preview={{ meta: author?.name ?? null, title }}
          target={contentTarget(manifest.id, topicContentType, topicId)}
          typeLabel={t("report_type")}
        />
      ) : null}
    </>
  );
};

const TopicJsonLd = ({
  data: { canonicalUrl, description, locale, thread, topic },
}: {
  data: Extract<TopicPageData, { accessRequired: false }>;
}) => {
  const json = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    ...(topic.author
      ? {
          author: {
            "@type": "Person",
            name: topic.author.name,
            url: absoluteUrl(
              `/users/${encodeURIComponent(topic.author.nameCode)}`,
              canonicalUrl,
            ),
          },
        }
      : {}),
    commentCount: thread.commentCount,
    dateModified: topic.updatedAt,
    datePublished: topic.publishedAt ?? topic.createdAt,
    headline: topic.title,
    inLanguage: locale,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: thread.commentCount,
    },
    mainEntityOfPage: canonicalUrl,
    text: description,
    url: canonicalUrl,
  };

  return (
    <script
      // oxlint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- JSON-LD has to be raw JSON; `<` is escaped so it cannot close the tag
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(json).replaceAll("<", "\\u003c"),
      }}
      type="application/ld+json"
    />
  );
};

const TopicAccessRequired = () => {
  const t = useTranslations("@vitnode/forum.forums");

  return (
    <div className="container mx-auto flex max-w-3xl px-4 py-8 md:py-12">
      <ContentAccessRequired>
        <HrefLink
          className={buttonVariants({ variant: "outline" })}
          href={FORUM_HREF}
        >
          {t("not_found.back")}
        </HrefLink>
      </ContentAccessRequired>
    </div>
  );
};

const TopicPage = (props: PluginRoutePageProps<TopicPageData, TopicSearch>) =>
  props.loaderData.accessRequired ? (
    <TopicAccessRequired />
  ) : (
    <TopicView {...props} loaderData={props.loaderData} />
  );

const TopicView = ({
  loaderData,
  navigate,
  search,
}: Omit<PluginRoutePageProps<TopicPageData, TopicSearch>, "loaderData"> & {
  loaderData: Extract<TopicPageData, { accessRequired: false }>;
}) => {
  const t = useTranslations("@vitnode/forum.topics.detail");
  const { canComment, thread, topic, trail } = loaderData;
  const created = search.created === true;
  const announcedRef = useRef(false);
  const forum = trail.at(-1);
  useRecordView({ itemId: topic.id, itemType: topicContentType.id });

  useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the event happened on the previous page; landing here is all that is left of it
    if (!created || announcedRef.current) return;
    announcedRef.current = true;

    toast.success(t("created.title"), { description: t("created.desc") });
    void navigate({ resetScroll: false, search: {} });
  }, [created, navigate, t]);

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
      <TopicJsonLd data={loaderData} />

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-4">
          {forum ? (
            <HrefLink
              className="text-primary self-start text-sm font-medium hover:underline"
              href={forumHref(forum.slug)}
            >
              {forum.name}
            </HrefLink>
          ) : null}

          <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {topic.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <PersonAvatar person={topic.author} size={40} />
              <div className="flex flex-col text-sm leading-relaxed">
                <PersonName person={topic.author} />
                <span className="text-muted-foreground">
                  {t("posted")}{" "}
                  <TimeAgo date={topic.publishedAt ?? topic.createdAt} />
                </span>
              </div>
            </div>

            <nav aria-label={t("actions")} className="flex flex-wrap gap-2">
              <TopicViewerActions
                author={topic.author}
                title={topic.title}
                topicId={topic.id}
              />
              {forum ? (
                <HrefLink
                  className={buttonVariants({ size: "sm", variant: "ghost" })}
                  href={topicNewHref(forum.id)}
                >
                  {t("new")}
                </HrefLink>
              ) : null}
            </nav>
          </div>
        </header>

        <RichTextContent
          className="text-foreground leading-relaxed text-pretty"
          content={topic.body}
        />
      </article>

      <ForumThread
        canReply={canComment}
        initial={thread}
        topicId={topic.id}
        topicSlug={topic.slug}
      />
    </div>
  );
};

export default TopicPage;
