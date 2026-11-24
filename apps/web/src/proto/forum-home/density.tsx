// Prototype - riff 4 "Density": the baseline page, plus a Cards / Compact
// switch next to the sort - the reader picks how much to see at once. Compact
// is one row per topic: points, title, forum, author, comments, activity.
// The choice is remembered in this browser.
import type { FeedTopic, Forum } from '@vitnode/forum/pages/forum-data'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { FEEDBACK_TONE_TEXT } from '@vitnode/core/components/ui/feedback-tone'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { FeedPendingSkeleton } from '@vitnode/core/tanstack/pending'
import {
  forumHref,
  topicHref,
  topicNewHref,
} from '@vitnode/forum/pages/forum-links'
import { ForumShell, PersonName, TimeAgo } from '@vitnode/forum/pages/forum-ui'
import {
  FeedPagination,
  FeedSortNav,
  TopicFeed,
} from '@vitnode/forum/pages/topic-feed'
import { cn } from 'cn'
import {
  LayoutListIcon,
  MessageSquareIcon,
  PenSquareIcon,
  Rows3Icon,
} from 'lucide-react'
import React from 'react'
import { useFormatter, useTranslations } from 'use-intl'

import type { VariantProps } from './data'

import { useFeed, useHomeData } from './data'
import { ForumChips, ForumTree } from './parts'

type View = 'cards' | 'compact'
const STORAGE_KEY = 'proto.forum-home.view'
const listeners = new Set<() => void>()

const readView = (): View => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'compact' ? 'compact' : 'cards'
  } catch {
    return 'cards'
  }
}

const writeView = (view: View) => {
  try {
    localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // Private mode: the switch still works for this visit.
  }
  for (const listener of listeners) listener()
}

const useView = () =>
  React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    readView,
    () => 'cards' as const,
  )

const ViewSwitch = ({ view }: { view: View }) => {
  const options = [
    { icon: LayoutListIcon, label: 'Cards', value: 'cards' },
    { icon: Rows3Icon, label: 'Compact', value: 'compact' },
  ] as const

  return (
    <div
      aria-label="Topic layout"
      className="bg-muted flex items-center gap-1 rounded-lg p-1"
      role="group"
    >
      {options.map(({ icon: Icon, label, value }) => (
        <button
          aria-label={label}
          aria-pressed={view === value}
          className={cn(
            'focus-visible:ring-ring/50 flex size-10 items-center justify-center rounded-md outline-none focus-visible:ring-3 motion-safe:transition-colors md:size-8',
            view === value
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
          key={value}
          onClick={() => {
            writeView(value)
          }}
          title={label}
          type="button"
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      ))}
    </div>
  )
}

const CompactRow = ({ forum, topic }: { forum?: Forum; topic: FeedTopic }) => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()

  return (
    <li className="hover:bg-muted/40 grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-3 px-3 py-2.5 motion-safe:transition-colors md:px-4">
      <span
        className={cn(
          'pt-0.5 text-end text-sm font-semibold tabular-nums',
          topic.points > 0 && FEEDBACK_TONE_TEXT.success,
          topic.points < 0 && FEEDBACK_TONE_TEXT.destructive,
          topic.points === 0 && 'text-muted-foreground',
        )}
      >
        {format.number(topic.points, { signDisplay: 'exceptZero' })}
        <span className="sr-only"> points</span>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <HrefLink
          className="text-foreground leading-snug font-medium text-pretty underline-offset-4 hover:underline"
          href={topicHref(topic.slug)}
        >
          {topic.title}
        </HrefLink>
        <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 text-xs leading-relaxed">
          {forum ? (
            <HrefLink
              className="text-foreground max-w-40 truncate font-medium underline-offset-4 hover:underline"
              href={forumHref(forum.slug)}
            >
              {forum.name}
            </HrefLink>
          ) : null}
          <span className="min-w-0 truncate">
            <PersonName person={topic.author} />
          </span>
          {topic.publishedAt ? <TimeAgo date={topic.publishedAt} /> : null}
          <span className="flex items-center gap-1 tabular-nums">
            <MessageSquareIcon aria-hidden="true" className="size-3" />
            {format.number(topic.commentCount)}
            <span className="sr-only"> comments</span>
          </span>
          {topic.commentCount > 0 && topic.lastActivityAt ? (
            <span>
              {t('last_comment')} <TimeAgo date={topic.lastActivityAt} />
            </span>
          ) : null}
        </p>
      </div>
    </li>
  )
}

export const Density = ({ hrefFor, search }: VariantProps) => {
  const t = useTranslations('@vitnode/forum.forums')
  const { forumsById, stats, tree } = useHomeData()
  const feed = useFeed(search)
  const view = useView()

  return (
    <ForumShell
      actions={
        <HrefLink className={buttonVariants()} href={topicNewHref()}>
          <PenSquareIcon aria-hidden="true" />
          {t('new_topic')}
        </HrefLink>
      }
      description={t('desc')}
      title={t('title')}
      wide
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <section
          aria-labelledby="density-feed"
          className="flex min-w-0 flex-col gap-4"
        >
          <h2 className="sr-only" id="density-feed">
            {t('feed.title')}
          </h2>
          <ForumChips className="lg:hidden" nodes={tree} />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <FeedSortNav hrefFor={hrefFor} search={search} />
            <ViewSwitch view={view} />
          </div>
          {feed.data ? (
            <div
              aria-busy={feed.isFetching}
              className={cn(
                'flex flex-col gap-4 motion-safe:transition-opacity',
                feed.isPlaceholderData && 'opacity-60',
              )}
            >
              {view === 'compact' && feed.data.topics.length > 0 ? (
                <ul className="bg-card flex flex-col divide-y overflow-hidden rounded-xl border">
                  {feed.data.topics.map((topic) => (
                    <CompactRow
                      forum={forumsById.get(topic.forum)}
                      key={topic.id}
                      topic={topic}
                    />
                  ))}
                </ul>
              ) : (
                <TopicFeed
                  forums={forumsById}
                  search={search}
                  topics={feed.data.topics}
                />
              )}
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

        <aside
          aria-labelledby="density-tree"
          className="bg-card hidden rounded-xl border p-2 lg:block"
        >
          <div className="flex flex-col gap-2">
            <h2
              className="text-foreground px-2 pt-2 text-sm font-semibold"
              id="density-tree"
            >
              {t('tree')}
            </h2>
            <nav aria-labelledby="density-tree">
              <ForumTree nodes={tree} stats={stats} />
            </nav>
          </div>
        </aside>
      </div>
    </ForumShell>
  )
}
