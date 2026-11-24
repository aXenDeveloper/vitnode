// Prototype - deleted after the decision. Not imported by production code.
import type { ForumSearch } from '@vitnode/forum/pages/forum-links'

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
    tree: contentContainerTree(forums),
  }
}

/** A feed that keeps the previous page on screen while the next one loads. */
export const useFeed = (search: ForumSearch) =>
  useQuery({ ...feedQueryOptions(search), placeholderData: keepPreviousData })

/** Props every variant gets: the URL's feed search and links that keep `?v`. */
export interface VariantProps {
  hrefFor: (search: ForumSearch) => string
  search: ForumSearch
}
