import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server'

interface ApiProbe {
  body: string
  label: string
  ok: boolean
  path: string
  status: number
}

/**
 * Two endpoints of the mounted API, both real:
 *
 * - the OpenAPI document, registered by `VitNodeAPI` itself, which answers
 *   without touching the database - so it isolates "is Hono mounted" from "is
 *   Postgres up";
 * - a plugin route, which runs the whole chain the API always runs: cors, csrf,
 *   rate limiter, `globalMiddleware` (session lookup included) and the plugin
 *   router the plugin id resolves to.
 */
const PROBES = [
  { label: 'OpenAPI document (no database)', path: '/api/swagger/doc' },
  {
    label: 'Core plugin route (full middleware chain)',
    path: '/api/@vitnode/core/middleware',
  },
] as const

const probeApi = createServerFn().handler(async (): Promise<ApiProbe[]> => {
  // Same-origin by construction: the API is mounted in this app, so the origin
  // of the request being rendered is the origin to call. No `NEXT_PUBLIC_API_URL`
  // and no second server involved.
  const { origin } = getRequestUrl()
  const cookie = getRequestHeader('cookie')
  const userAgent = getRequestHeader('user-agent')

  return await Promise.all(
    PROBES.map(async ({ label, path }) => {
      const headers = new Headers()
      // Forwarded so a signed-in SSR render is answered as that user. This is a
      // verification page, not the fetcher - real calls go through
      // `@vitnode/core`'s fetcher.
      if (cookie) headers.set('cookie', cookie)
      if (userAgent) headers.set('user-agent', userAgent)

      try {
        const response = await fetch(new URL(path, origin), { headers })
        const body = await response.text()

        return {
          body: body.slice(0, 600),
          label,
          ok: response.ok,
          path,
          status: response.status,
        }
      } catch (error) {
        return {
          body: error instanceof Error ? error.message : String(error),
          label,
          ok: false,
          path,
          status: 0,
        }
      }
    }),
  )
})

export const Route = createFileRoute('/api-check')({
  loader: async () => probeApi(),
  component: ApiCheck,
})

function ApiCheck() {
  const probes = Route.useLoaderData()

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-balance text-zinc-900 md:text-3xl dark:text-zinc-50">
          Hono API bridge
        </h1>
        <p className="leading-relaxed text-pretty text-zinc-600 dark:text-zinc-400">
          Rendered on the server. Each row is a same-origin request this app
          made to <code>/api/*</code> during SSR, answered by the VitNode Hono
          application mounted in this process.
        </p>
      </header>

      <ul className="flex flex-col gap-4">
        {probes.map((probe) => (
          <li
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            key={probe.path}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
                {probe.label}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                  probe.ok
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                }`}
              >
                <span className="sr-only">
                  {probe.ok ? 'Succeeded with status ' : 'Failed with status '}
                </span>
                {probe.status || 'no response'}
              </span>
            </div>
            <code className="text-sm text-zinc-600 dark:text-zinc-400">
              GET {probe.path}
            </code>
            <div className="overflow-x-auto">
              <pre className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {probe.body || '(empty body)'}
              </pre>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
