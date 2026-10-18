import { createFileRoute } from '@tanstack/react-router'
import { llms } from 'fumadocs-core/source'

import {
  DOCS_TEXT_CACHE_HEADERS,
  memoizeDocsText,
  source,
} from '@/docs/source.server'

const readIndex = memoizeDocsText(async () =>
  Promise.resolve(llms(source).index()),
)

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () =>
        new Response(await readIndex(), {
          headers: {
            ...DOCS_TEXT_CACHE_HEADERS,
            'content-type': 'text/plain; charset=utf-8',
          },
        }),
    },
  },
})
