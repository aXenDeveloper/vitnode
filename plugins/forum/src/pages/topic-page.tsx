import { RichTextContent } from "@vitnode/core/components/rich-text";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@vitnode/core/components/ui/breadcrumb";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  richTextToPlainText,
  zodRichTextDocument,
} from "@vitnode/core/content";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { localeAlternateLinks } from "@vitnode/core/tanstack/metadata";
import { PencilIcon } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

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
import { PersonAvatar, PersonName, TimeAgo } from "./forum-ui";
import { ForumThread } from "./thread";
import { fetchThreadPage } from "./thread-data";

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

const loadTopic = async ({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) => {
  const detail = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/topics",
    path: "/{slug}",
    args: { params: { slug: encodeURIComponent(slug) } },
  });

  if (detail.status !== 200 && detail.status !== 404) {
    throw new Error(`Loading the topic "${slug}" failed.`);
  }

  const topic = contentPageItem(
    detail.status === 200 ? zodTopic.parse(await detail.json()) : null,
  );

  const [forum, thread] = await Promise.all([
    fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "content/forums",
      path: "/{idOrSlug}",
      args: { params: { idOrSlug: String(topic.forum) } },
    }),
    fetchThreadPage({ topicId: topic.id }),
  ]);

  const trail =
    forum.status === 200
      ? await forum
          .json()
          .then(({ ancestors, container }) => [...ancestors, container])
      : [];

  const path = topicHref(topic.slug);
  const canonicalUrl =
    localeAlternateLinks({ alternates: { [locale]: path }, locale }).find(
      link => link.rel === "canonical",
    )?.href ?? path;

  return {
    canonicalUrl,
    description: excerptOf(
      richTextToPlainText(topic.body).replace(/\s+/g, " "),
    ),
    locale,
    thread: thread ?? {
      items: [],
      pageInfo: { endCursor: null, hasNextPage: false, totalCount: 0 },
      replyCount: 0,
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

export const route = definePluginRoute<TopicPageData, TopicSearch>({
  load: async ({ context, params }) =>
    await loadTopic({ locale: context.locale, slug: params.slug }),

  head: ({ loaderData }) => ({
    alternates: loaderData
      ? { [loaderData.locale]: topicHref(loaderData.topic.slug) }
      : undefined,
    description: loaderData?.description,
    title: loaderData?.topic.title,
  }),

  breadcrumb: {
    group: ({ loaderData }) => (
      <>
        <BreadcrumbItem>
          <BreadcrumbLink href={FORUM_HREF}>
            <ForumsCrumb />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {loaderData.trail.map(forum => (
          <Fragment key={forum.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={forumHref(forum.slug)}>
                {forum.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Fragment>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{loaderData.topic.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </>
    ),
  },
});

/** Rendered in the browser from the session, so a cached page stays shared. */
const TopicOwnerActions = ({
  author,
  topicId,
}: {
  author: ForumPerson;
  topicId: number;
}) => {
  const t = useTranslations("@vitnode/forum.topics.detail");
  const { data: session } = useSessionQuery();
  const userId = session?.user?.id;

  if (userId === undefined || author === null || author.id !== userId) {
    return null;
  }

  return (
    <a
      className={buttonVariants({ size: "sm", variant: "outline" })}
      href={topicEditHref(topicId)}
    >
      <PencilIcon aria-hidden="true" />
      {t("edit")}
    </a>
  );
};

const TopicJsonLd = ({
  data: { canonicalUrl, description, locale, thread, topic },
}: {
  data: TopicPageData;
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
    commentCount: thread.replyCount,
    dateModified: topic.updatedAt,
    datePublished: topic.publishedAt ?? topic.createdAt,
    headline: topic.title,
    inLanguage: locale,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: thread.replyCount,
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

const TopicPage = ({
  loaderData,
  navigate,
  search,
}: PluginRoutePageProps<TopicPageData, TopicSearch>) => {
  const t = useTranslations("@vitnode/forum.topics.detail");
  const { thread, topic, trail } = loaderData;
  const created = search.created === true;
  const announcedRef = useRef(false);
  const forum = trail.at(-1);

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
            <a
              className="text-primary self-start text-sm font-medium hover:underline"
              href={forumHref(forum.slug)}
            >
              {forum.name}
            </a>
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
              <TopicOwnerActions author={topic.author} topicId={topic.id} />
              {forum ? (
                <a
                  className={buttonVariants({ size: "sm", variant: "ghost" })}
                  href={topicNewHref(forum.id)}
                >
                  {t("new")}
                </a>
              ) : null}
            </nav>
          </div>
        </header>

        <RichTextContent
          className="text-foreground leading-relaxed text-pretty"
          content={topic.body}
        />
      </article>

      <ForumThread initial={thread} topicId={topic.id} topicSlug={topic.slug} />
    </div>
  );
};

export default TopicPage;
