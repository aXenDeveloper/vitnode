import { createFileRoute } from '@tanstack/react-router'

import { AiUnlimitedProto } from '@/proto/ai-unlimited/harness'

export const Route = createFileRoute('/_main/proto/ai-unlimited')({
  head: () => ({ meta: [{ title: 'AI unlimited prototype' }, { name: 'robots', content: 'noindex' }] }),
  component: AiUnlimitedProto,
})
