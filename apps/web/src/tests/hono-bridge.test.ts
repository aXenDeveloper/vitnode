import { describe, expect, it } from 'vitest'

import type { ApiBridge } from './api-bridge-contract'

import {
  API_BASE,
  createApiFixture,
  describeApiBridgeContract,
} from './api-bridge-contract'

/**
 * The reference bridge: hand the incoming `Request` to Hono untouched.
 *
 * It is one line on purpose. Everything the contract asks for - status,
 * body, `Set-Cookie`, cookies, user-agent, forwarded IPs - is already correct
 * in the request the platform built, and stays correct exactly as long as
 * nobody rebuilds it. The tests below show what breaks when somebody does.
 */
describeApiBridgeContract(
  'hono app.fetch',
  (app) => async (request) => app.fetch(request),
)

describe('bridges that rebuild the request', () => {
  const call = async (bridge: ApiBridge, init?: RequestInit) => {
    const request = new Request(`https://web.test${API_BASE}/echo`, init)

    return bridge(request)
  }

  it('drops the request context when only method and body are carried over', async () => {
    const fixture = createApiFixture()
    // The tempting shortcut: read what you think you need off the request.
    const lossy: ApiBridge = async (request) =>
      fixture.app.fetch(
        new Request(request.url, { method: request.method, body: null }),
      )

    await call(lossy, {
      headers: {
        cookie: 'vitnode_session=s3cr3t',
        'user-agent': 'Firefox/140.0',
        'x-forwarded-for': '203.0.113.7',
      },
    })

    const received = fixture.received.at(0)
    expect(received?.headers.cookie).toBeUndefined()
    expect(received?.headers['user-agent']).toBeUndefined()
    // Which is the whole auth session, the device record and the rate-limit
    // key gone at once - and nothing in the response says so.
    expect(received?.headers['x-forwarded-for']).toBeUndefined()
  })

  it('collapses Set-Cookie when the response headers go through a plain object', async () => {
    const fixture = createApiFixture()
    const lossy: ApiBridge = async (request) => {
      const response = await fixture.app.fetch(request)

      return new Response(response.body, {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      })
    }

    const res = await lossy(new Request(`https://web.test${API_BASE}/cookies`))

    // Two cookies went in, one came out: `Object.fromEntries` keeps the last
    // value of a repeated header, and `Headers` joins them into one string.
    expect(res.headers.getSetCookie()).not.toEqual([
      'session=abc; Path=/; HttpOnly',
      'device=xyz; Path=/; HttpOnly',
    ])
  })

  it('loses the query string when the path is forwarded without the search', async () => {
    const fixture = createApiFixture()
    const lossy: ApiBridge = async (request) => {
      const url = new URL(request.url)

      return fixture.app.request(url.pathname, request)
    }

    const res = await lossy(
      new Request(`https://web.test${API_BASE}/echo?q=one&q=two`),
    )

    expect(await res.json()).toMatchObject({ query: [] })
  })
})
