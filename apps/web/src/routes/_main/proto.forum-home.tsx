// Prototype route - deleted after the decision.
import { createFileRoute } from '@tanstack/react-router'
import { forumSearch } from '@vitnode/forum/pages/forum-links'

import { ForumHomeProto } from '@/proto/forum-home/harness'

const ProtoPage = () => {
  const { v, ...search } = Route.useSearch()

  return <ForumHomeProto initial={v - 1} search={search} />
}

export const Route = createFileRoute('/_main/proto/forum-home')({
  validateSearch: (search: Record<string, unknown>) => ({
    v: Number(search.v) || 1,
    ...forumSearch(search),
  }),
  head: () => ({ meta: [{ title: 'Forum home - prototype' }] }),
  component: ProtoPage,
})
