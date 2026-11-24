// Prototype - variant 2 "Board": the forum index comes first (Invision-style),
// the feed shrinks to a three-card "Trending" strip.
import type { ContentContainerTreeNode } from '@vitnode/core/content'
import type { Forum, ForumStats } from '@vitnode/forum/pages/forum-data'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { HrefLink } from '@vitnode/core/tanstack/link'
import {
  forumHref,
  topicHref,
  topicNewHref,
} from '@vitnode/forum/pages/forum-links'
import { ForumIcon, TimeAgo } from '@vitnode/forum/pages/forum-ui'
import { FlameIcon, MessageSquareIcon, PenSquareIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import { useFeed, useHomeData } from './data'

const Trending = () => {
  const format = useFormatter()
  const { forumsById } = useHomeData()
  const feed = useFeed({ sort: 'hot' })
  const topics = feed.data?.topics.slice(0, 3) ?? []
  if (topics.length === 0) return null

  return (
    <section aria-labelledby="board-trending" className="flex flex-col gap-3">
      <h2
        className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase"
        id="board-trending"
      >
        <FlameIcon aria-hidden="true" className="text-primary size-4" />
        Trending now
      </h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {topics.map((topic) => {
          const forum = forumsById.get(topic.forum)

          return (
            <li
              className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4"
              key={topic.id}
            >
              {forum ? (
                <span className="text-muted-foreground truncate text-xs font-medium">
                  {forum.name}
                </span>
              ) : null}
              <HrefLink
                className="text-foreground line-clamp-2 font-semibold text-balance underline-offset-4 hover:underline"
                href={topicHref(topic.slug)}
              >
                {topic.title}
              </HrefLink>
              <p className="text-muted-foreground mt-auto flex items-center gap-3 text-sm tabular-nums">
                <span>
                  {format.number(topic.points, { signDisplay: 'exceptZero' })}{' '}
                  points
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquareIcon aria-hidden="true" className="size-3.5" />
                  {topic.commentCount}
                </span>
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const ForumRow = ({
  node,
  stats,
}: {
  node: ContentContainerTreeNode<Forum>
  stats: ReadonlyMap<number, ForumStats>
}) => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const own = stats.get(node.id)
  const latest = own?.latestTopic ?? null

  return (
    <li className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_9rem_14rem] md:items-center md:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <ForumIcon icon={node.metadata.icon} />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-semibold text-balance">
            <HrefLink
              className="text-foreground underline-offset-4 hover:underline"
              href={forumHref(node.slug)}
            >
              {node.name}
            </HrefLink>
          </h3>
          {node.metadata.description ? (
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {node.metadata.description}
            </p>
          ) : null}
          {node.children.length > 0 ? (
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="sr-only">{t('subforums')}:</span>
              {node.children.map((child) => (
                <HrefLink
                  className="text-foreground flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                  href={forumHref(child.slug)}
                  key={child.id}
                >
                  <span
                    aria-hidden="true"
                    className="bg-primary/60 size-1.5 rounded-full"
                  />
                  {child.name}
                </HrefLink>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="text-muted-foreground flex gap-6 text-sm md:justify-end">
        <div className="flex flex-col md:items-end">
          <dt className="text-xs">{t('stats.topics')}</dt>
          <dd className="text-foreground font-semibold tabular-nums">
            {format.number(own?.topicCount ?? 0)}
          </dd>
        </div>
        <div className="flex flex-col md:items-end">
          <dt className="text-xs">{t('stats.comments')}</dt>
          <dd className="text-foreground font-semibold tabular-nums">
            {format.number(own?.commentCount ?? 0)}
          </dd>
        </div>
      </dl>

      <div className="flex min-w-0 flex-col gap-0.5 text-sm leading-relaxed md:border-s md:ps-4">
        {latest ? (
          <>
            <HrefLink
              className="text-foreground truncate font-medium underline-offset-4 hover:underline"
              href={topicHref(latest.slug)}
              title={latest.title}
            >
              {latest.title}
            </HrefLink>
            {latest.publishedAt ? (
              <span className="text-muted-foreground text-xs">
                <TimeAgo date={latest.publishedAt} />
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">{t('no_topics_yet')}</span>
        )}
      </div>
    </li>
  )
}

export const Board = () => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const { stats, totals, tree } = useHomeData()

  return (
    <div className="container mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {t('title')}
          </h1>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t('desc')}{' '}
            <span className="tabular-nums">
              {format.number(totals.topics)} topics ·{' '}
              {format.number(totals.comments)} comments
            </span>
          </p>
        </div>
        <HrefLink className={buttonVariants()} href={topicNewHref()}>
          <PenSquareIcon aria-hidden="true" />
          {t('new_topic')}
        </HrefLink>
      </header>

      <Trending />

      <section aria-labelledby="board-forums" className="flex flex-col gap-3">
        <h2
          className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
          id="board-forums"
        >
          {t('tree')}
        </h2>
        <ol className="bg-card divide-y overflow-hidden rounded-xl border">
          {tree.map((node) => (
            <ForumRow key={node.id} node={node} stats={stats} />
          ))}
        </ol>
      </section>
    </div>
  )
}
