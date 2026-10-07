import { createFileRoute } from '@tanstack/react-router'
import { getRequestIP } from '@tanstack/react-start/server'

import { apiBridge } from '@/server/vitnode-api.server'

// `getRequestIP()` without `xForwardedFor` is the accepted socket, which a
// visitor cannot write. Without it every browser call shares one address and
// one rate-limit bucket.
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        ANY: async ({ request }) =>
          apiBridge(request, { clientAddress: getRequestIP() }),
      }),
  },
})
