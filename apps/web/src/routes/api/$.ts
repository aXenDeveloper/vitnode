import { createFileRoute } from '@tanstack/react-router'

import { apiBridge } from '#/server/vitnode-api.server'

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({ ANY: async ({ request }) => apiBridge(request) }),
  },
})
