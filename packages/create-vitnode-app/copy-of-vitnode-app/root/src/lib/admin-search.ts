import { createServerFn } from '@tanstack/react-start'
import { readAdminUserSearchOnApi } from '@vitnode/core/tanstack/admin/server'
import { z } from 'zod'

/**
 * The AdminCP command palette's user lookup, as this app's server function.
 *
 * One handler, one line, exactly like `lib/auth.ts` - and here for the same
 * reason. `createServerFn` needs the module it sits in to be transformed by the
 * Start compiler on both sides of the render, and `@vitnode/core` reaches the
 * server un-compiled (see the note in `lib/auth.ts`), so the declaration lives
 * in the host and the behaviour lives in the package.
 *
 * ## Why it has a validator
 *
 * A server function is a public same-origin endpoint: its input is whatever a
 * caller posts, not whatever the dialog typed. This value reaches an API query
 * string, so it is parsed rather than trusted - trimmed, length-bounded, and a
 * string at all.
 *
 * The bound is not a security control; the API authorizes the read from the
 * admin cookie and pages it itself. It is a cheap refusal of the requests that
 * could only ever be abuse - a megabyte of "search term" that the API would
 * otherwise have to hand to Postgres.
 *
 * `POST` puts it behind `createCsrfMiddleware` in `src/start.ts`, which matters
 * more here than it looks: this reads other people's names and email addresses,
 * and a `GET` would be reachable from another origin's page with the
 * administrator's cookies attached.
 */
const adminUserSearchInput = z.object({
  search: z.string().trim().min(1).max(128),
})

export const adminUserSearchFn = createServerFn({ method: 'POST' })
  .validator(adminUserSearchInput)
  .handler(async ({ data }) => await readAdminUserSearchOnApi(data.search))
