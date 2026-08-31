import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

import { DOCS_TREE_STALE_TIME, memoizePerSource } from '#/docs/freshness'

import { withoutComments } from './source'

/**
 * How long a documentation build stays true, and what happens while somebody is
 * writing one.
 *
 * Three things are derived from `content/docs` and all three were cached for the
 * life of the process: the page tree, the search index and `/llms-full.txt`.
 * That is right in production - the collection is build output, frozen when the
 * server started - and wrong for the whole time anybody is editing, because it
 * means a renamed page needs a dev-server restart to appear in the sidebar.
 *
 * Pure: `memoizePerSource` takes its source loader as an argument, so every rule
 * below is exercised with a plain object standing in for the module. No Vite, no
 * dev server, and no documentation.
 */
const here = dirname(fileURLToPath(import.meta.url))
const appSrc = resolve(here, '..')

describe('the docs page tree stale policy', () => {
  it('is Infinity in production and 0 in development', () => {
    // Vitest runs with `import.meta.env.PROD === false`, so the constant read
    // here is the development one. Both halves are asserted off the source
    // below, which is the only way to see the branch this build did not take.
    expect(DOCS_TREE_STALE_TIME).toBe(0)
  })

  it('branches on the build rather than on anything at runtime', () => {
    const source = withoutComments(join(appSrc, 'docs/freshness.ts'))

    expect(source).toContain(
      'export const DOCS_TREE_STALE_TIME = import.meta.env.PROD ? Infinity : 0',
    )
    // Not the host, the URL or a header: this is a property of how the
    // application was built, and nothing else may decide it.
    expect(source).not.toMatch(/typeof window|process\.env|NODE_ENV/)
  })

  it('is what the docs shell route uses', () => {
    const route = withoutComments(join(appSrc, 'routes/_docs.tsx'))

    expect(route).toMatch(/staleTime:\s*DOCS_TREE_STALE_TIME/)
    expect(route).not.toMatch(/staleTime:\s*Infinity/)
  })
})

describe('memoizePerSource', () => {
  /** A source module, and a way to replace it the way Vite would. */
  const sources = () => {
    let current = { version: 1 }

    return {
      load: async () => await Promise.resolve(current),
      replace: () => {
        current = { version: current.version + 1 }
      },
    }
  }

  it('computes once and reuses the result while the source is the same', async () => {
    const { load } = sources()
    const compute = vi.fn(async (source: { version: number }) =>
      Promise.resolve(`built ${source.version}`),
    )
    const value = memoizePerSource(load, compute)

    expect(await value()).toBe('built 1')
    expect(await value()).toBe('built 1')
    expect(await value()).toBe('built 1')
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('computes once for two simultaneous first callers', async () => {
    // The promise is stored before it is awaited, so a burst of requests on a
    // cold server builds one index rather than one each.
    const { load } = sources()
    const compute = vi.fn(async () => Promise.resolve('built'))
    const value = memoizePerSource(load, compute)

    expect(await Promise.all([value(), value(), value()])).toEqual([
      'built',
      'built',
      'built',
    ])
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('recomputes when the source module has been replaced', async () => {
    // What a documentation edit looks like: Vite re-executes the collection, so
    // the next `import()` answers with a different module namespace.
    const { load, replace } = sources()
    const compute = vi.fn(async (source: { version: number }) =>
      Promise.resolve(`built ${source.version}`),
    )
    const value = memoizePerSource(load, compute)

    expect(await value()).toBe('built 1')
    replace()
    expect(await value()).toBe('built 2')
    expect(compute).toHaveBeenCalledTimes(2)
  })

  it('reuses the new result until the source changes again', async () => {
    // The half a plain "recompute in development" would throw away: two
    // searches between two edits must not rebuild the index twice.
    const { load, replace } = sources()
    const compute = vi.fn(async () => Promise.resolve('built'))
    const value = memoizePerSource(load, compute)

    await value()
    replace()
    await value()
    await value()
    await value()

    expect(compute).toHaveBeenCalledTimes(2)
  })

  it('goes back to the cached result if an older source comes back', async () => {
    // A property of keying on identity rather than on a counter, and worth
    // pinning: nothing here assumes versions only move forwards.
    const first = { version: 1 }
    const second = { version: 2 }
    let current = first
    const compute = vi.fn(async (source: { version: number }) =>
      Promise.resolve(`built ${source.version}`),
    )
    const value = memoizePerSource(
      async () => await Promise.resolve(current),
      compute,
    )

    expect(await value()).toBe('built 1')
    current = second
    expect(await value()).toBe('built 2')
    current = first
    expect(await value()).toBe('built 1')
    expect(compute).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failure', async () => {
    // A search that failed to build an index must be retryable. Nothing clears
    // the entry today, so this is the assertion that would fail if that
    // changed - and it is written as the behaviour, not as the implementation.
    const { load } = sources()
    let attempt = 0
    const value = memoizePerSource(load, async () => {
      attempt += 1
      if (attempt === 1) throw new Error('index build failed')

      return await Promise.resolve('built')
    })

    await expect(value()).rejects.toThrow('index build failed')
    await expect(value()).rejects.toThrow('index build failed')
    // Documented as it is: the rejected promise is what is cached, so a failed
    // build stays failed until the source changes. That is the honest reading
    // of the current code rather than an aspiration.
    expect(attempt).toBe(1)
  })
})

/**
 * The two expensive derivations go through the one helper.
 *
 * Static, because what is being asserted is that neither route grew its own
 * `let` back. The behaviour of the helper itself is covered above.
 */
describe('the search index and the LLM text share the policy', () => {
  it.each([
    ['routes/docs.search.ts', 'docsSearchApi'],
    ['routes/llms-full[.]txt.ts', 'docsAsMarkdown'],
  ])('%s memoizes per docs source', (file, name) => {
    const source = withoutComments(join(appSrc, file))

    expect(source).toMatch(new RegExp(`const ${name} = memoizePerSource\\(`))
    // Each route passes its own loader, which is what keeps the collection out
    // of `freshness.ts` - and therefore out of the browser build, since
    // `_docs.tsx` imports the stale-time constant from there.
    expect(source).toContain("await import('#/docs/source.server')")
  })

  it('keeps the docs source out of the client-safe helper', () => {
    const helper = withoutComments(join(appSrc, 'docs/freshness.ts'))

    expect(helper).not.toContain('source.server')
    expect(helper).not.toMatch(/import\(/)
  })

  it.each(['routes/docs.search.ts', 'routes/llms-full[.]txt.ts'])(
    '%s holds no promise of its own',
    (file) => {
      const source = withoutComments(join(appSrc, file))

      // The shape this replaced: `let x: Promise<T> | undefined` plus `x ??=`.
      expect(source).not.toMatch(/let\s+\w+:\s*Promise</)
      expect(source).not.toMatch(/\?\?=/)
    },
  )
})
