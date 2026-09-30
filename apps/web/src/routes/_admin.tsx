import { createFileRoute } from '@tanstack/react-router'
import { adminLayoutRoute } from '@vitnode/core/tanstack/admin'

export const Route = createFileRoute('/_admin')(
  adminLayoutRoute(async () => await import('@/admin-nav.gen')),
)
