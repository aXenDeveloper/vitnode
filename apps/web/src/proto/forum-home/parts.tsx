// Prototype - shared pieces of the riff variants. Deleted after the decision.
import type { ContentContainerTreeNode } from '@vitnode/core/content'
import type { Forum, ForumStats } from '@vitnode/forum/pages/forum-data'
import type { ForumSearch } from '@vitnode/forum/pages/forum-links'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { HrefLink } from '@vitnode/core/tanstack/link'
import { FeedPendingSkeleton } from '@vitnode/core/tanstack/pending'
import { forumHref } from '@vitnode/forum/pages/forum-links'
import { ForumIcon } from '@vitnode/forum/pages/forum-ui'
import {
  FeedPagination,
  FeedSortNav,
  TopicFeed,
} from '@vitnode/forum/pages/topic-feed'
import { cn } from 'cn'
import { LockIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import { useFeed, useHomeData } from './data'

export const ForumTree = ({
  depth = 0,
  nodes,
  stats,
}: {
  depth?: number
  nodes: ContentContainerTreeNode<Forum>[]
  stats: ReadonlyMap<number, ForumStats>
}) => {
  const t = useTranslations('@vitnode/forum.forums')
  const format = useFormatter()

  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => (
        <li className="flex flex-col gap-1" key={node.id}>
          <HrefLink
            className="hover:bg-muted focus-visible:ring-ring flex min-h-10 items-center gap-3 rounded-lg px-2 py-1.5 focus-visible:ring-2 focus-visible:outline-none motion-safe:transition-colors"
            href={forumHref(node.slug)}
          >
            <ForumIcon
              className={depth === 0 ? 'size-7' : 'size-6'}
              icon={node.metadata.icon}
            />
            <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
              {node.name}
            </span>
            {node.access.canRead ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                <span className="sr-only">{t('stats.topics')}: </span>
                {format.number(stats.get(node.id)?.topicCount ?? 0)}
              </span>
            ) : (
              <LockIcon
                aria-label={t('members_only')}
                className="text-muted-foreground size-3.5"
                role="img"
              />
            )}
          </HrefLink>
          {node.children.length > 0 ? (
            <div className="ms-5 border-s ps-2">
              <ForumTree
                depth={depth + 1}
                nodes={node.children}
                stats={stats}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** The forum chips the baseline shows on phones instead of the sidebar. */
export const ForumChips = ({
  className,
  nodes,
}: {
  className?: string
  nodes: ContentContainerTreeNode<Forum>[]
}) => {
  const t = useTranslations('@vitnode/forum.forums')

  return (
    <nav
      aria-label={t('tree')}
      className={cn('flex gap-2 overflow-x-auto', className)}
    >
      {nodes.map((node) => (
        <HrefLink
          className={buttonVariants({
            className: 'shrink-0',
            size: 'sm',
            variant: 'outline',
          })}
          href={forumHref(node.slug)}
          key={node.id}
        >
          <ForumIcon className="size-5" icon={node.metadata.icon} />
          {node.name}
        </HrefLink>
      ))}
    </nav>
  )
}

/** Sort, the baseline feed cards and pages - the URL drives all three. */
export const BaselineFeed = ({
  hrefFor,
  search,
}: {
  hrefFor: (search: ForumSearch) => string
  search: ForumSearch
}) => {
  const { forumsById } = useHomeData()
  const feed = useFeed(search)

  return (
    <>
      <FeedSortNav hrefFor={hrefFor} search={search} />
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
    </>
  )
}
