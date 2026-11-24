// Prototype - riff 5 "Focus": the baseline without a sidebar. One reading
// column, a composer prompt on top ("start a topic" is the first thing you
// can do), forums as a scrolling strip with their counts, and a sort bar that
// sticks under the header while you read down the feed.
import { HrefLink } from '@vitnode/core/tanstack/link'
import { FeedPendingSkeleton } from '@vitnode/core/tanstack/pending'
import { forumHref, topicNewHref } from '@vitnode/forum/pages/forum-links'
import { ForumIcon } from '@vitnode/forum/pages/forum-ui'
import {
  FeedPagination,
  FeedSortNav,
  TopicFeed,
} from '@vitnode/forum/pages/topic-feed'
import { cn } from 'cn'
import { PenSquareIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import type { VariantProps } from './data'

import { useFeed, useHomeData } from './data'

const ForumStrip = () => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const { forums, stats } = useHomeData()

  return (
    <nav aria-label={t('tree')} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {forums.map((forum) => (
          <li className="shrink-0" key={forum.id}>
            <HrefLink
              className="bg-card hover:bg-muted focus-visible:ring-ring flex min-h-11 items-center gap-2 rounded-full border py-1 ps-1 pe-3 focus-visible:ring-2 focus-visible:outline-none motion-safe:transition-colors"
              href={forumHref(forum.slug)}
            >
              <ForumIcon
                className="size-8 rounded-full"
                icon={forum.metadata.icon}
              />
              <span className="text-foreground max-w-48 truncate text-sm font-medium">
                {forum.name}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                <span className="sr-only">{t('stats.topics')}: </span>
                {format.number(stats.get(forum.id)?.topicCount ?? 0)}
              </span>
            </HrefLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

const ComposerPrompt = () => {
  const t = useTranslations('@vitnode/forum.forums')

  return (
    <HrefLink
      className="bg-card hover:bg-muted/40 focus-visible:ring-ring group flex items-center gap-3 rounded-xl border p-3 shadow-xs focus-visible:ring-2 focus-visible:outline-none motion-safe:transition-colors"
      href={topicNewHref()}
    >
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full"
      >
        <PenSquareIcon className="size-4" />
      </span>
      <span className="text-muted-foreground bg-muted/60 flex min-h-10 flex-1 items-center rounded-lg px-3 text-base md:text-sm">
        Ask a question or share something…
      </span>
      <span className="text-foreground hidden text-sm font-medium sm:inline">
        {t('new_topic')}
      </span>
    </HrefLink>
  )
}

export const Focus = ({ hrefFor, search }: VariantProps) => {
  const t = useTranslations('@vitnode/forum.forums')
  const { forumsById } = useHomeData()
  const feed = useFeed(search)

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
          {t('title')}
        </h1>
        <p className="text-muted-foreground leading-relaxed text-pretty">
          {t('desc')}
        </p>
      </header>

      <ComposerPrompt />
      <ForumStrip />

      <section aria-labelledby="focus-feed" className="flex flex-col gap-4">
        <h2 className="sr-only" id="focus-feed">
          {t('feed.title')}
        </h2>
        <div className="bg-background/90 sticky top-14 z-10 -mx-4 border-b px-4 py-2 backdrop-blur sm:top-16">
          <FeedSortNav hrefFor={hrefFor} search={search} />
        </div>
        {feed.data ? (
          <div
            aria-busy={feed.isFetching}
            className={cn(
              'flex flex-col gap-4 motion-safe:transition-opacity',
              feed.isPlaceholderData && 'opacity-60',
            )}
          >
            <TopicFeed
              forums={forumsById}
              search={search}
              topics={feed.data.topics}
            />
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
    </div>
  )
}
