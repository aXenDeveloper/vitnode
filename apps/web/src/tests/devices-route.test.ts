import type * as DevicesRevokeModule from '@vitnode/core/views/auth/settings/devices/devices-revoke'
import type { RevokeDeviceResult } from '@vitnode/core/views/auth/settings/devices/devices-revoke'

import { hashKey, QueryClient } from '@tanstack/react-query'
import { DEVICES_QUERY_KEY } from '@vitnode/core/views/auth/settings/devices/devices-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `/settings/devices`'s contract with the cache underneath it.
 *
 * Pure functions and one `QueryClient` held in memory. The *meaning* of a devices
 * request - the key, the request, what a refusal is, and whether a finished
 * revoke makes the list stale - is core's, and is asserted in
 * `packages/vitnode/src/views/auth/settings/devices/devices-query.test.ts`. What
 * is asserted here is that this app asks for the right one, and that a revoke
 * invalidates exactly the one entry it should and nothing else.
 *
 * The revoke's transport is stubbed rather than reached. There is no HTTP here:
 * the only thing under test is which statuses cause an invalidation, which is the
 * decision that replaced `revalidatePath('/[locale]/(main)', 'layout')`.
 */

/** What the stubbed browser revoke answers with on the next call. */
let nextRevokeResult: RevokeDeviceResult = { data: true }

vi.mock(
  '@vitnode/core/views/auth/settings/devices/devices-revoke',
  async (importOriginal) => ({
    // Everything real except the one function that would open a socket - so
    // `shouldRefreshAfterRevoke`, the rule actually being exercised, is core's
    // own and not a second copy of it written for this test.
    ...(await importOriginal<typeof DevicesRevokeModule>()),
    revokeDeviceInBrowser: async () => Promise.resolve(nextRevokeResult),
  }),
)

const { devicesQuery, invalidateDevices, revokeDevice } =
  await import('#/lib/devices/devices')

/** The two entries a devices invalidation must tell apart. */
const SESSION_KEY = ['vitnode', 'session'] as const
const MESSAGES_KEY = ['intl', 'en', 'core.global'] as const

const seed = () => {
  const queryClient = new QueryClient()

  queryClient.setQueryData(devicesQuery().queryKey, { devices: [] })
  queryClient.setQueryData(SESSION_KEY, { user: { id: 1 } })
  queryClient.setQueryData(MESSAGES_KEY, { messages: {} })

  return queryClient
}

const isStale = (queryClient: QueryClient, queryKey: readonly unknown[]) =>
  queryClient.getQueryState(queryKey)?.isInvalidated === true

beforeEach(() => {
  nextRevokeResult = { data: true }
})

describe('this app asks for core’s devices list, not its own', () => {
  it('lands in the canonical entry', () => {
    // The loader and the component both call `devicesQuery()`, and it has to be
    // the entry core's own invalidation names or a revoke would refresh nothing.
    expect(hashKey(devicesQuery().queryKey)).toBe(hashKey(DEVICES_QUERY_KEY))
  })

  it('carries no locale, because the data is the same in every language', () => {
    // An OS name, a browser, an IP address and two timestamps do not change with
    // the language. A locale in the key would refetch on every language switch.
    expect(devicesQuery().queryKey).toEqual(['devices', 'me'])
  })

  it('asks once, so a 429 is not answered by two more requests', () => {
    expect(devicesQuery().retry).toBe(false)
  })
})

describe('a revoke makes the devices list stale, and only that', () => {
  it('marks the list stale when a device actually went', async () => {
    const queryClient = seed()

    await invalidateDevices(queryClient)

    expect(isStale(queryClient, DEVICES_QUERY_KEY)).toBe(true)
  })

  it('leaves everything else in the cache alone', async () => {
    // Emphatically not `invalidateQueries()` with no key, and not
    // `router.invalidate()`: the session and the messages have not changed
    // because a phone was signed out. Refetching them would be the blunt version
    // of the `revalidatePath` this replaces.
    const queryClient = seed()

    await invalidateDevices(queryClient)

    expect(isStale(queryClient, SESSION_KEY)).toBe(false)
    expect(isStale(queryClient, MESSAGES_KEY)).toBe(false)
  })

  it('keeps the rows on screen while the fresh ones are fetched', async () => {
    // Invalidating rather than removing, so the list is not blanked under a
    // dialog that is still closing.
    const queryClient = seed()

    await invalidateDevices(queryClient)

    expect(queryClient.getQueryData(DEVICES_QUERY_KEY)).toBeDefined()
  })

  it('does not invalidate the session, because the current device cannot be revoked', async () => {
    // The API answers 400 for the device the request itself comes from, so no
    // revoke reachable from this page can end the session performing it. There is
    // no state in which a successful revoke leaves the cached session falsely
    // authenticated - which is why this invalidation is one key rather than two.
    const queryClient = seed()

    await revokeDevice(queryClient, { publicId: 'a1b2c3' })

    expect(isStale(queryClient, SESSION_KEY)).toBe(false)
  })
})

describe('the revoke refreshes on exactly the statuses that changed something', () => {
  it('refreshes after a success', async () => {
    const queryClient = seed()
    nextRevokeResult = { data: true }

    await revokeDevice(queryClient, { publicId: 'a1b2c3' })

    expect(isStale(queryClient, DEVICES_QUERY_KEY)).toBe(true)
  })

  it.each([404, 400])(
    'refreshes after a %i, because the row on screen was already wrong',
    async (status) => {
      const queryClient = seed()
      nextRevokeResult = { error: { status } }

      await revokeDevice(queryClient, { publicId: 'a1b2c3' })

      expect(isStale(queryClient, DEVICES_QUERY_KEY)).toBe(true)
    },
  )

  it.each([401, 403, 429, 500])(
    'leaves the list alone after a %i, which deleted nothing',
    async (status) => {
      // The refetch would be a second request into whatever refused the first: a
      // rate limiter answered by immediately asking again, or an ended session
      // answered by a 401 that blanks the list being read.
      const queryClient = seed()
      nextRevokeResult = { error: { status } }

      await revokeDevice(queryClient, { publicId: 'a1b2c3' })

      expect(isStale(queryClient, DEVICES_QUERY_KEY)).toBe(false)
    },
  )

  it('returns the finite result to the caller either way', async () => {
    const queryClient = seed()
    nextRevokeResult = { error: { status: 429 } }

    expect(await revokeDevice(queryClient, { publicId: 'a1b2c3' })).toEqual({
      error: { status: 429 },
    })
  })
})
