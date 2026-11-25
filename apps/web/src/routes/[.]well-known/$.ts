import { createFileRoute } from '@tanstack/react-router'
import { getRequestIP } from '@tanstack/react-start/server'
import { executionContextOf } from '@vitnode/api/lib/after-response'
import { mcpWellKnownRequest } from '@vitnode/api/lib/mcp/well-known'

import { apiBridge } from '@/server/vitnode-api.server'

// MCP clients discover OAuth at the origin's root
// (`/.well-known/oauth-authorization-server/api/mcp`), outside `/api`.
export const Route = createFileRoute('/.well-known/$')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        ANY: async ({ request }) => {
          const forwarded = mcpWellKnownRequest(request, {
            apiBasePath: '/api',
          })
          if (!forwarded) return new Response('Not Found', { status: 404 })

          return apiBridge(
            forwarded,
            { clientAddress: getRequestIP() },
            executionContextOf(request),
          )
        },
      }),
  },
})
