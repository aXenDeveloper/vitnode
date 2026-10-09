import { createFileRoute } from '@tanstack/react-router'
import { llms } from 'fumadocs-core/source'

import { source } from '@/docs/source.server'

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(llms(source).index(), {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
    },
  },
})
