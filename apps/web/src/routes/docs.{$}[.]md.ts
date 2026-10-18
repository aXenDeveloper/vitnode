import { createFileRoute } from '@tanstack/react-router'

import { movedDocsPath } from '@/docs/redirects'
import { decodeMarkdownUrl, encodeMarkdownUrl } from '@/docs/shared'
import {
  DOCS_TEXT_CACHE_HEADERS,
  getLLMText,
  source,
} from '@/docs/source.server'

export const Route = createFileRoute('/docs/{$}.md')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slugs = decodeMarkdownUrl(params._splat?.split('/') ?? [])
        const moved = movedDocsPath(slugs.join('/'))

        if (moved) {
          return Response.redirect(
            new URL(encodeMarkdownUrl(moved.split('/')), request.url),
            301,
          )
        }

        const page = source.getPage(slugs)

        if (!page) return new Response('Not Found', { status: 404 })

        return new Response(await getLLMText(page), {
          headers: {
            ...DOCS_TEXT_CACHE_HEADERS,
            'content-type': 'text/markdown; charset=utf-8',
          },
        })
      },
    },
  },
})
