// Prototype route - deleted after the decision.
import { createFileRoute } from '@tanstack/react-router'

import { ForumHomeProto } from '@/proto/forum-home/harness'

const ProtoPage = () => <ForumHomeProto initial={Route.useSearch().v - 1} />

export const Route = createFileRoute('/_main/proto/forum-home')({
  validateSearch: (search: Record<string, unknown>) => ({
    v: Number(search.v) || 1,
  }),
  head: () => ({ meta: [{ title: 'Forum home - prototype' }] }),
  component: ProtoPage,
})
