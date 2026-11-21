// Prototype route - throwaway, deleted with src/proto/user-preview.
import { createFileRoute } from '@tanstack/react-router'

import { UserPreviewPrototype } from '@/proto/user-preview/harness'

const Screen = () => {
  const { v } = Route.useSearch()

  return <UserPreviewPrototype initial={v - 1} />
}

export const Route = createFileRoute('/_main/proto/user-preview')({
  validateSearch: (search: Record<string, unknown>) => ({
    v: Number(search.v) || 1,
  }),
  component: Screen,
})
