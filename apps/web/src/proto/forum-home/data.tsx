// Prototype - deleted after the decision. Not imported by production code.
import type { FeedRequest } from '@vitnode/forum/pages/forum-queries'

import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { contentContainerTree } from '@vitnode/core/content'
import { useLocale } from '@vitnode/core/tanstack/i18n'
import {
  feedQueryOptions,
  forumsQueryOptions,
  forumStatsQueryOptions,
} from '@vitnode/forum/pages/forum-queries'

export const useHomeData = () => {
  const locale = useLocale()
  const forums = useSuspenseQuery(forumsQueryOptions(locale)).data
  const stats = useSuspenseQuery(forumStatsQueryOptions()).data
  const tree = contentContainerTree(forums)

  return {
    forums,
    forumsById: new Map(forums.map((forum) => [forum.id, forum])),
    stats: new Map(stats.map((item) => [item.forumId, item])),
    totals: stats.reduce(
      (sum, item) => ({
        comments: sum.comments + item.commentCount,
        topics: sum.topics + item.topicCount,
      }),
      { comments: 0, topics: 0 },
    ),
    tree,
  }
}

/** A feed that keeps the previous page on screen while the next one loads. */
export const useFeed = (request: FeedRequest) =>
  useQuery({ ...feedQueryOptions(request), placeholderData: keepPreviousData })

export const SORTS = ['hot', 'new', 'active', 'top'] as const
export type Sort = (typeof SORTS)[number]
