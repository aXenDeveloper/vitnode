import '@tanstack/react-start/server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import { VitNodeAPI } from '@vitnode/core/api/config'

import { createApiBridge } from '#/server/api-bridge'
import { vitNodeApiConfig } from '#/vitnode.api.config'

// The same two lines `apps/api` and `apps/docs` run. `basePath("/api")` is what
// makes the mount point part of the API's own routing, so every path the plugins
// register - `/api/@vitnode/core/...` - resolves identically here.
const createVitNodeApi = () => {
  const app = new OpenAPIHono().basePath('/api')

  VitNodeAPI({ app, vitNodeApiConfig })

  return app
}

// `VitNodeAPI` is a boot step, not a request step: it opens the Redis client,
// starts the cron scheduler and registers every plugin route. Vite re-evaluates
// server modules on HMR, so the instance is parked on `globalThis` to keep one
// API per process instead of one per edit.
const cache = globalThis as typeof globalThis & {
  __vitnodeApi?: ReturnType<typeof createVitNodeApi>
}

export const vitNodeApi = (cache.__vitnodeApi ??= createVitNodeApi())

export const apiBridge = createApiBridge(vitNodeApi)
