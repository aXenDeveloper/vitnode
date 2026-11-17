import { ClientOnly, createFileRoute } from '@tanstack/react-router'

import { OfflinePrototype } from '@/proto/offline/harness'

// PROTOTYPE: offline page variants - delete with src/proto/offline.
export const Route = createFileRoute('/proto/offline')({
  component: () => (
    <ClientOnly>
      <OfflinePrototype />
    </ClientOnly>
  ),
})
