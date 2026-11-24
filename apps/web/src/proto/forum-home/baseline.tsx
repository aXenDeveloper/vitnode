// Prototype - variant 1: the current /forum page, unchanged.
import { useSuspenseQuery } from '@tanstack/react-query'
import { contentContainerTree } from '@vitnode/core/content'
import { useLocale } from '@vitnode/core/tanstack/i18n'
import {
  feedQueryOptions,
  forumsQueryOptions,
  forumStatsQueryOptions,
} from '@vitnode/forum/pages/forum-queries'
import ForumsPage from '@vitnode/forum/pages/forums-page'

export const Baseline = () => {
  const locale = useLocale()
  const forums = useSuspenseQuery(forumsQueryOptions(locale)).data
  const stats = useSuspenseQuery(forumStatsQueryOptions()).data
  const feed = useSuspenseQuery(feedQueryOptions({})).data

  return (
    <ForumsPage
      loaderData={{
        feed,
        forums,
        search: {},
        stats,
        tree: contentContainerTree(forums),
      }}
      navigate={async () => {}}
      params={{}}
      search={{}}
    />
  )
}
