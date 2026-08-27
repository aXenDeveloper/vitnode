import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { vitNodeEnv } from '../../vitnode-env'

const ENV_FILE = [
  'NEXT_PUBLIC_API_URL=https://api.example.test',
  'NEXT_PUBLIC_WEB_URL=https://web.example.test',
  'NEXT_PUBLIC_UNLISTED=also-public-by-name',
  'POSTGRES_URL=postgresql://root:hunter2@db.internal:5432/vitnode',
  'CRON_SECRET=super-secret',
  'REDIS_PASSWORD=another-secret',
].join('\n')

const TOUCHED = [
  'CRON_SECRET',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_UNLISTED',
  'NEXT_PUBLIC_WEB_URL',
  'POSTGRES_URL',
  'REDIS_PASSWORD',
]

/** Calls the plugin's `config` hook the way Vite calls it. */
const runConfig = async (root: string) => {
  const { config } = vitNodeEnv()
  if (typeof config !== 'function') throw new Error('expected a config hook')

  return config.call(
    // The hook only reads `root` and only returns config, so the plugin context
    // Vite would pass is not involved.
    undefined as never,
    { root },
    { command: 'build', mode: 'production' },
  )
}

const clientDefine = (
  result: Awaited<ReturnType<typeof runConfig>>,
): Record<string, string> =>
  (result?.environments?.client?.define ?? {}) as Record<string, string>

describe('vitNodeEnv', () => {
  let root: string
  const saved = new Map<string, string | undefined>()

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vitnode-env-'))
    writeFileSync(join(root, '.env'), ENV_FILE)
    for (const key of TOUCHED) {
      saved.set(key, process.env[key])
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    saved.clear()
  })

  it('loads the whole .env into process.env for the server', async () => {
    await runConfig(root)

    // Including the values only the API needs - it runs in this process.
    expect(process.env.POSTGRES_URL).toBe(
      'postgresql://root:hunter2@db.internal:5432/vitnode',
    )
    expect(process.env.NEXT_PUBLIC_API_URL).toBe('https://api.example.test')
  })

  it('lets a real environment variable win over the .env file', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://from-the-platform.test'

    await runConfig(root)

    expect(process.env.NEXT_PUBLIC_API_URL).toBe(
      'https://from-the-platform.test',
    )
  })

  it('inlines the API and web URLs into the client bundle', async () => {
    expect(clientDefine(await runConfig(root))).toStrictEqual({
      'process.env.NEXT_PUBLIC_API_URL': '"https://api.example.test"',
      // Temporary migration infrastructure, unset in this fixture. See
      // `src/lib/legacy-app.ts`; it goes away with the last legacy route.
      'process.env.NEXT_PUBLIC_LEGACY_WEB_URL': 'undefined',
      'process.env.NEXT_PUBLIC_WEB_URL': '"https://web.example.test"',
    })
  })

  it('publishes nothing to the client beyond the two listed keys', async () => {
    // The point of an explicit list. A secret reaching a browser bundle is not
    // recoverable by rotating a build, and `NEXT_PUBLIC_UNLISTED` shows that
    // even a public-looking name is not enough to get there.
    const define = clientDefine(await runConfig(root))

    for (const secret of ['POSTGRES_URL', 'CRON_SECRET', 'REDIS_PASSWORD']) {
      expect(define).not.toHaveProperty(`process.env.${secret}`)
    }
    expect(define).not.toHaveProperty('process.env.NEXT_PUBLIC_UNLISTED')
    expect(JSON.stringify(define)).not.toContain('hunter2')
  })

  it('leaves the server bundle reading the live environment', async () => {
    // Nothing is defined for `ssr`, so `CONFIG`'s lazy getters keep reading
    // `process.env` at request time and a built server can be pointed at a
    // different API by its host.
    const result = await runConfig(root)

    expect(result?.define).toBeUndefined()
    expect(result?.environments?.ssr).toBeUndefined()
  })

  it('replaces an unset key with undefined rather than leaving the read in', async () => {
    writeFileSync(join(root, '.env'), 'POSTGRES_URL=postgresql://only/this')

    // Left in place, `process.env.NEXT_PUBLIC_API_URL` throws in a browser
    // instead of falling through to the default the core config has for it.
    expect(clientDefine(await runConfig(root))).toStrictEqual({
      'process.env.NEXT_PUBLIC_API_URL': 'undefined',
      'process.env.NEXT_PUBLIC_LEGACY_WEB_URL': 'undefined',
      'process.env.NEXT_PUBLIC_WEB_URL': 'undefined',
    })
  })
})
