import { createFileRoute } from '@tanstack/react-router'

import {
  DOCS_TEXT_CACHE_HEADERS,
  getLLMText,
  memoizeDocsText,
  source,
} from '@/docs/source.server'

const readFullText = memoizeDocsText(async () => {
  const pages = await Promise.all(source.getPages().map(getLLMText))

  return pages.join('\n\n')
})

export const Route = createFileRoute('/llms-full.txt')({
  server: {
    handlers: {
      GET: async () =>
        new Response(await readFullText(), {
          headers: {
            ...DOCS_TEXT_CACHE_HEADERS,
            'content-type': 'text/plain; charset=utf-8',
          },
        }),
    },
  },
})
