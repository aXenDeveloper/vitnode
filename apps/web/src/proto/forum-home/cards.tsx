// Prototype - riff 3 "Cards": the baseline's layout, but every topic is its
// own card. The forum's icon anchors each card on the left, the title gets
// more weight, and points, reactions and comments sit in a footer bar. The
// sidebar sticks and opens with an "about" card holding the call to action.
import type { FeedTopic, Forum } from '@vitnode/forum/pages/forum-data'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { contentTarget } from '@vitnode/core/content'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { FeedPendingSkeleton } from '@vitnode/core/tanstack/pending'
import { ReactionBar, ReactionPoints } from '@vitnode/core/tanstack/reactions'
import { topicContentType } from '@vitnode/forum/content/topic'
import {
  forumHref,
  topicHref,
  topicNewHref,
} from '@vitnode/forum/pages/forum-links'
import {
  ForumIcon,
  PersonAvatar,
  PersonName,
  TimeAgo,
} from '@vitnode/forum/pages/forum-ui'
import { FeedPagination, FeedSortNav } from '@vitnode/forum/pages/topic-feed'
import { cn } from 'cn'
import { MessageSquareIcon, PenSquareIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import type { VariantProps } from './data'

import { useFeed, useHomeData } from './data'
import { ForumChips, ForumTree } from './parts'

const TopicCard = ({ forum, topic }: { forum?: Forum; topic: FeedTopic }) => {
  const t = useTranslations('@vitnode/forum.forums')
  const titleId = `card-${topic.id}`
  const target = contentTarget('@vitnode/forum', topicContentType, topic.id)

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className="bg-card flex flex-col rounded-xl border shadow-xs"
      >
        <div className="flex gap-4 p-4 md:p-5">
          {forum ? (
            <HrefLink
              aria-hidden="true"
              className="hidden shrink-0 sm:block"
              href={forumHref(forum.slug)}
              tabIndex={-1}
            >
              <ForumIcon icon={forum.metadata.icon} />
            </HrefLink>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed">
              {forum ? (
                <>
                  <HrefLink
                    className="text-foreground font-semibold underline-offset-4 hover:underline"
                    href={forumHref(forum.slug)}
                  >
                    {forum.name}
                  </HrefLink>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <span className="flex items-center gap-2">
                <PersonAvatar person={topic.author} size={24} />
                <PersonName person={topic.author} />
              </span>
              {topic.publishedAt ? (
                <>
                  <span aria-hidden="true">·</span>
                  <TimeAgo date={topic.publishedAt} />
                </>
              ) : null}
            </p>
            <h3
              className="text-foreground text-xl leading-snug font-semibold tracking-tight text-balance"
              id={titleId}
            >
              <HrefLink
                className="underline-offset-4 hover:underline"
                href={topicHref(topic.slug)}
              >
                {topic.title}
              </HrefLink>
            </h3>
            {topic.excerpt ? (
              <p className="text-muted-foreground line-clamp-3 leading-relaxed text-pretty break-words">
                {topic.excerpt}
              </p>
            ) : null}
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <ReactionPoints initial={topic.points} target={target} />
            <ReactionBar target={target} />
          </div>
          <HrefLink
            className={buttonVariants({ size: 'sm', variant: 'ghost' })}
            href={`${topicHref(topic.slug)}#comments`}
          >
            <MessageSquareIcon aria-hidden="true" />
            {t('comment_count', { count: topic.commentCount })}
          </HrefLink>
        </footer>
      </article>
    </li>
  )
}

const About = () => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const { totals } = useHomeData()

  return (
    <section
      aria-label={t('title')}
      className="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-xs"
    >
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t('desc')}
      </p>
      <dl className="flex gap-6">
        <div className="flex flex-col">
          <dt className="text-muted-foreground text-xs">{t('stats.topics')}</dt>
          <dd className="text-foreground text-lg font-semibold tabular-nums">
            {format.number(totals.topics)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground text-xs">
            {t('stats.comments')}
          </dt>
          <dd className="text-foreground text-lg font-semibold tabular-nums">
            {format.number(totals.comments)}
          </dd>
        </div>
      </dl>
      <HrefLink
        className={buttonVariants({ className: 'w-full' })}
        href={topicNewHref()}
      >
        <PenSquareIcon aria-hidden="true" />
        {t('new_topic')}
      </HrefLink>
    </section>
  )
}

export const Cards = ({ hrefFor, search }: VariantProps) => {
  const t = useTranslations('@vitnode/forum.forums')
  const { forumsById, stats, tree } = useHomeData()
  const feed = useFeed(search)

  return (
    <div className="container mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
          {t('title')}
        </h1>
        <HrefLink
          className={buttonVariants({ className: 'lg:hidden' })}
          href={topicNewHref()}
        >
          <PenSquareIcon aria-hidden="true" />
          {t('new_topic')}
        </HrefLink>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section
          aria-labelledby="cards-feed"
          className="flex min-w-0 flex-col gap-4"
        >
          <h2 className="sr-only" id="cards-feed">
            {t('feed.title')}
          </h2>
          <ForumChips className="lg:hidden" nodes={tree} />
          <FeedSortNav hrefFor={hrefFor} search={search} />
          {feed.data ? (
            <div
              aria-busy={feed.isFetching}
              className={cn(
                'flex flex-col gap-4 motion-safe:transition-opacity',
                feed.isPlaceholderData && 'opacity-60',
              )}
            >
              <ul className="flex flex-col gap-3">
                {feed.data.topics.map((topic) => (
                  <TopicCard
                    forum={forumsById.get(topic.forum)}
                    key={topic.id}
                    topic={topic}
                  />
                ))}
              </ul>
              <FeedPagination
                hasNextPage={feed.data.pageInfo.hasNextPage}
                hrefFor={hrefFor}
                search={search}
              />
            </div>
          ) : (
            <FeedPendingSkeleton />
          )}
        </section>

        <aside className="hidden flex-col gap-4 lg:sticky lg:top-20 lg:flex">
          <About />
          <section
            aria-labelledby="cards-tree"
            className="bg-card flex flex-col gap-2 rounded-xl border p-2 shadow-xs"
          >
            <h2
              className="text-foreground px-2 pt-2 text-sm font-semibold"
              id="cards-tree"
            >
              {t('tree')}
            </h2>
            <nav aria-labelledby="cards-tree">
              <ForumTree nodes={tree} stats={stats} />
            </nav>
          </section>
        </aside>
      </div>
    </div>
  )
}
