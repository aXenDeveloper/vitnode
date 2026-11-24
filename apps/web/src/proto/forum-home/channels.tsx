// Prototype - variant 5 "Channels": a different interaction model. Forums are
// a channel list (Discord/Slack-style); picking one filters the feed in place
// instead of navigating, and the header becomes that forum's header.
import type { ContentContainerTreeNode } from '@vitnode/core/content'
import type { Forum } from '@vitnode/forum/pages/forum-data'

import { Button, buttonVariants } from '@vitnode/core/components/ui/button'
import { contentTarget } from '@vitnode/core/content'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { ReactionPoints } from '@vitnode/core/tanstack/reactions'
import { topicContentType } from '@vitnode/forum/content/topic'
import { topicHref, topicNewHref } from '@vitnode/forum/pages/forum-links'
import {
  ForumIcon,
  PersonAvatar,
  PersonName,
  TimeAgo,
} from '@vitnode/forum/pages/forum-ui'
import { cn } from 'cn'
import {
  HashIcon,
  LayersIcon,
  MessageSquareIcon,
  PenSquareIcon,
} from 'lucide-react'
import React from 'react'
import { useFormatter, useTranslations } from 'use-intl'

import type { Sort } from './data'

import { SORTS, useFeed, useHomeData } from './data'

const flatten = (
  nodes: ContentContainerTreeNode<Forum>[],
  depth = 0,
): { depth: number; forum: Forum }[] =>
  nodes.flatMap((node) => [
    { depth, forum: node },
    ...flatten(node.children, depth + 1),
  ])

const ChannelButton = ({
  active,
  children,
  count,
  depth = 0,
  onSelect,
}: {
  active: boolean
  children: React.ReactNode
  count?: number
  depth?: number
  onSelect: () => void
}) => {
  const format = useFormatter()

  return (
    <button
      aria-current={active ? 'true' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 flex min-h-11 w-full shrink-0 items-center gap-2 rounded-lg px-2 text-start text-sm outline-none focus-visible:ring-3 motion-safe:transition-colors lg:min-h-9',
        active
          ? 'bg-primary/10 text-foreground font-semibold'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        depth > 0 && 'lg:ps-7',
      )}
      onClick={onSelect}
      type="button"
    >
      {children}
      {count === undefined ? null : (
        <span className="text-muted-foreground ms-auto ps-2 text-xs font-normal tabular-nums">
          {format.number(count)}
        </span>
      )}
    </button>
  )
}

export const Channels = () => {
  const t = useTranslations('@vitnode/forum.forums')
  const { forumsById, stats, totals, tree } = useHomeData()
  const [forumId, setForumId] = React.useState<number | undefined>()
  const [sort, setSort] = React.useState<Sort>('hot')
  const feed = useFeed({ forumId, sort })
  const channels = flatten(tree)
  const current = forumId === undefined ? undefined : forumsById.get(forumId)
  const topics = feed.data?.topics ?? []

  return (
    <div className="container mx-auto grid max-w-6xl gap-6 px-4 py-6 md:py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <nav aria-label={t('tree')} className="min-w-0">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          <li className="shrink-0">
            <ChannelButton
              active={forumId === undefined}
              count={totals.topics}
              onSelect={() => {
                setForumId(undefined)
              }}
            >
              <LayersIcon aria-hidden="true" className="size-4 shrink-0" />
              All forums
            </ChannelButton>
          </li>
          {channels.map(({ depth, forum }) => (
            <li className="shrink-0 lg:min-w-0" key={forum.id}>
              <ChannelButton
                active={forum.id === forumId}
                count={stats.get(forum.id)?.topicCount ?? 0}
                depth={depth}
                onSelect={() => {
                  setForumId(forum.id)
                }}
              >
                <HashIcon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate whitespace-nowrap lg:whitespace-normal">
                  {forum.name}
                </span>
              </ChannelButton>
            </li>
          ))}
        </ul>
      </nav>

      <section
        aria-labelledby="channel-title"
        className="flex min-w-0 flex-col gap-5"
      >
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {current ? <ForumIcon icon={current.metadata.icon} /> : null}
            <div className="flex min-w-0 flex-col gap-1">
              <h1
                className="text-2xl font-semibold tracking-tight text-balance"
                id="channel-title"
              >
                {current?.name ?? t('title')}
              </h1>
              <p className="text-muted-foreground max-w-prose leading-relaxed text-pretty">
                {current
                  ? (current.metadata.description ??
                    t('forum_desc_fallback', { name: current.name }))
                  : t('desc')}
              </p>
            </div>
          </div>
          <HrefLink
            className={buttonVariants({ className: 'shrink-0' })}
            href={topicNewHref(forumId)}
          >
            <PenSquareIcon aria-hidden="true" />
            {t('new_topic')}
          </HrefLink>
        </header>

        <div
          aria-label={t('feed.sort.label')}
          className="flex flex-wrap gap-1"
          role="group"
        >
          {SORTS.map((item) => (
            <Button
              aria-pressed={item === sort}
              key={item}
              onClick={() => {
                setSort(item)
              }}
              size="sm"
              variant={item === sort ? 'secondary' : 'ghost'}
            >
              {t(`feed.sort.${item}`)}
            </Button>
          ))}
        </div>

        {feed.isPending ? (
          <p className="text-muted-foreground py-8" role="status">
            Loading topics…
          </p>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
            <p className="font-semibold">{t('empty_forum.title')}</p>
            <p className="text-muted-foreground leading-relaxed">
              {t('empty_forum.desc')}
            </p>
          </div>
        ) : (
          <ol
            aria-busy={feed.isFetching}
            className={cn(
              'flex flex-col gap-2 motion-safe:transition-opacity',
              feed.isPlaceholderData && 'opacity-60',
            )}
          >
            {topics.map((topic) => {
              const forum = forumsById.get(topic.forum)

              return (
                <li
                  className="hover:bg-muted/50 flex items-start gap-4 rounded-xl p-3"
                  key={topic.id}
                >
                  <PersonAvatar person={topic.author} size={40} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                      <span className="text-foreground min-w-0 truncate font-medium">
                        <PersonName person={topic.author} />
                      </span>
                      {topic.publishedAt ? (
                        <TimeAgo date={topic.publishedAt} />
                      ) : null}
                      {forumId === undefined && forum ? (
                        <button
                          className="text-primary max-w-48 truncate py-1 underline-offset-4 hover:underline"
                          onClick={() => {
                            setForumId(forum.id)
                          }}
                          type="button"
                        >
                          #{forum.name}
                        </button>
                      ) : null}
                    </p>
                    <HrefLink
                      className="text-foreground font-semibold text-balance underline-offset-4 hover:underline"
                      href={topicHref(topic.slug)}
                    >
                      {topic.title}
                    </HrefLink>
                    {topic.excerpt ? (
                      <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed text-pretty">
                        {topic.excerpt}
                      </p>
                    ) : null}
                    <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-sm">
                      <ReactionPoints
                        initial={topic.points}
                        target={contentTarget(
                          '@vitnode/forum',
                          topicContentType,
                          topic.id,
                        )}
                      />
                      <span className="flex items-center gap-1 tabular-nums">
                        <MessageSquareIcon
                          aria-hidden="true"
                          className="size-4"
                        />
                        {t('comment_count', { count: topic.commentCount })}
                      </span>
                      {topic.commentCount > 0 && topic.lastActivityAt ? (
                        <span>
                          {t('last_comment')}{' '}
                          <TimeAgo date={topic.lastActivityAt} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
