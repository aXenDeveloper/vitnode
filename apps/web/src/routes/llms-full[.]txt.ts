import { createFileRoute } from '@tanstack/react-router'

import { memoizePerSource } from '#/docs/freshness'

const docsAsMarkdown = memoizePerSource(
  async () => await import('#/docs/source.server'),
  async ({ getLLMText, source }) =>
    (await Promise.all(source.getPages().map(getLLMText))).join('\n\n'),
)

export const Route = createFileRoute('/llms-full.txt')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async () =>
          new Response(await docsAsMarkdown(), {
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          }),
      }),
  },
})
