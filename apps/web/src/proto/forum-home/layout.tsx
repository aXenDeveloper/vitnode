// Prototype - the page around the card riffs: header, sort, feed, pages and
// a sticky sidebar. Each variant brings its own list. Deleted after the
// decision.
import type { FeedTopic, Forum } from '@vitnode/forum/pages/forum-data'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { FeedPendingSkeleton } from '@vitnode/core/tanstack/pending'
import { topicNewHref } from '@vitnode/forum/pages/forum-links'
import { FeedPagination, FeedSortNav } from '@vitnode/forum/pages/topic-feed'
import { cn } from 'cn'
import { PenSquareIcon } from 'lucide-react'
import React from 'react'
import { useFormatter, useTranslations } from 'use-intl'

import type { VariantProps } from './data'

import { useFeed, useHomeData } from './data'
import { ForumChips, ForumTree } from './parts'

/** A wrapping line of meta items with a dot between them. Every item carries
 * a leading dot, and the line is shifted left by one dot and clipped, so the
 * dot that would start a line - the first, or one after a wrap - is hidden. */
export const MetaLine = ({ children }: { children: React.ReactNode }) => (
  <div className="text-muted-foreground overflow-hidden text-sm leading-relaxed">
    <p className="-ms-6 flex flex-wrap items-center gap-y-1">{children}</p>
  </div>
)

export const MetaItem = ({ children }: { children: React.ReactNode }) => (
  <span className="flex min-w-0 items-center before:w-6 before:shrink-0 before:text-center before:content-['·']">
    <span className="flex min-w-0 items-center gap-2">{children}</span>
  </span>
)

const About = ({ surface }: { surface: string }) => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()
  const { totals } = useHomeData()

  return (
    <section
      aria-label={t('title')}
      className={cn('flex flex-col gap-4 p-4', surface)}
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

export const CardsLayout = ({
  hrefFor,
  list,
  maxWidth = 'max-w-6xl',
  search,
  surface = 'bg-card rounded-xl border shadow-xs',
}: VariantProps & {
  list: (
    topics: FeedTopic[],
    forums: ReadonlyMap<number, Forum>,
  ) => React.ReactNode
  maxWidth?: string
  /** Classes of the sidebar's boxes, so they match the variant's cards. */
  surface?: string
}) => {
  const t = useTranslations('@vitnode/forum.forums')
  const { forumsById, stats, tree } = useHomeData()
  const feed = useFeed(search)

  return (
    <div
      className={cn(
        'container mx-auto flex flex-col gap-6 px-4 py-8 md:py-12',
        maxWidth,
      )}
    >
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
              {list(feed.data.topics, forumsById)}
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
          <About surface={surface} />
          <section
            aria-labelledby="cards-tree"
            className={cn('flex flex-col gap-2 p-2', surface)}
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
