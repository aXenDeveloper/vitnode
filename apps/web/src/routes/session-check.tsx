import { createFileRoute } from '@tanstack/react-router'

import { getSession } from '#/lib/session'

/**
 * Whether the API recognises the visitor rendering this page.
 *
 * The one thing Stage 1 has to be able to show: `@vitnode/core`'s fetcher,
 * called during SSR, answered for the *browser's* session rather than for the
 * server. Signed out it reads "anonymous"; sign in through any VitNode app on
 * this host and it names the user - without this page knowing anything about
 * authentication.
 */
export const Route = createFileRoute('/session-check')({
  component: SessionCheck,
  loader: async () => getSession(),
})

function SessionCheck() {
  const { user } = Route.useLoaderData()

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-balance text-zinc-900 md:text-3xl dark:text-zinc-50">
          Session forwarding
        </h1>
        <p className="leading-relaxed text-pretty text-zinc-600 dark:text-zinc-400">
          Rendered on the server. The API was asked who is signed in through{' '}
          <code>@vitnode/core</code>&apos;s fetcher, with this request&apos;s
          cookies, <code>user-agent</code> and forwarded IP attached.
        </p>
      </header>

      <dl className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">
            Identified as
          </dt>
          <dd
            className={`rounded-full px-2 py-0.5 text-sm font-medium ${
              user
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {user ? user.name : 'anonymous'}
          </dd>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-zinc-600 dark:text-zinc-400">User ID</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{user.id}</dd>
          </div>
        ) : null}
      </dl>
    </main>
  )
}
