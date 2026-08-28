import { describe, expect, it } from 'vitest'

import { sessionQueryOptions } from '#/lib/auth/query'
import { SESSION_QUERY_KEY } from '#/lib/auth/shared'

/**
 * The canonical session query's policy, as plain options.
 *
 * No client, no render, no request - `sessionQueryOptions()` is an object, and
 * these are the two fields of it whose being wrong is silent. A missing
 * `retry: false` costs nothing that a test can see and everything in production:
 * a rate-limited session read would be sent twice more before the route could
 * report anything, which is both slower and precisely what the limiter asked
 * this app to stop doing.
 *
 * This is the one auth test that loads `#/lib/auth/query` at runtime rather than
 * as a type. It reaches the server fetcher module through `#/lib/session`, which
 * is why the other auth tests import `SessionApi` type-only - there is nothing
 * to execute here, only an options object to read back.
 */
describe('the canonical session query', () => {
  it('asks once and lets the failure surface', () => {
    expect(sessionQueryOptions().retry).toBe(false)
  })

  it('is the one entry every guard and component reads', () => {
    expect(sessionQueryOptions().queryKey).toEqual(SESSION_QUERY_KEY)
  })
})
