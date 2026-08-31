import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { DOCS_SOURCE_DIRECTORY, docsGithubUrl } from '#/docs/github'

import { withoutComments } from './source'

/**
 * The documentation source, now that this application owns it.
 *
 * Stage 16 copied `apps/docs/content/docs` into `apps/web/content/docs` and made
 * the TanStack app the runtime owner. What this file asserts is the half of that
 * which is easy to get half-right: that the content is actually here, that
 * nothing reaches back into the application Stage 17 deletes, and that a reader
 * who clicks "Open in GitHub" is sent to the file that will still exist
 * afterwards.
 *
 * Static only. Whether a document *renders* is a browser's question and is not
 * asked anywhere in this suite.
 */
const here = dirname(fileURLToPath(import.meta.url))
const appSrc = resolve(here, '..')
const appRoot = resolve(appSrc, '..')
const repoRoot = resolve(appRoot, '../..')
const contentRoot = join(appRoot, 'content/docs')

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return []

  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)

    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

const contentFiles = filesUnder(contentRoot).map((path) =>
  relative(contentRoot, path).split(sep).join('/'),
)

describe('the documentation source lives in this application', () => {
  it('has the whole collection, not a sample of it', () => {
    // A number rather than a manifest: the point is that the copy is the real
    // documentation and not three files somebody used to test the pipeline. It
    // is a floor, so writing a new page never fails this.
    expect(
      contentFiles.filter((path) => path.endsWith('.mdx')).length,
    ).toBeGreaterThan(100)
    expect(
      contentFiles.filter((path) => path.endsWith('meta.json')).length,
    ).toBeGreaterThan(15)
  })

  it('kept the images and diagrams beside the prose', () => {
    // Seven documents import a screenshot relative to themselves. A copy that
    // took only the Markdown would fail the build rather than degrade, but it
    // is worth stating that the assets are part of the source.
    const assets = contentFiles.filter((path) => /\.(png|svg)$/.test(path))

    expect(assets.length).toBeGreaterThan(5)
    expect(assets).toContain('dev/ai/ai-registry-routing.svg')
  })

  it('kept the three sections and their nesting', () => {
    for (const path of [
      'dev/index.mdx',
      'dev/meta.json',
      'dev/plugins/create.mdx',
      'dev/plugins/api/routes.mdx',
      'dev/sso/facebook/1.png',
      'guides/index.mdx',
      'ui/index.mdx',
      'ui/hooks/use-mobile.mdx',
    ]) {
      expect(contentFiles, path).toContain(path)
    }
  })

  /**
   * The permanent boundary: `apps/web` does not read from `apps/docs`.
   *
   * `home-route.test.ts` states it for import specifiers. This states it for the
   * documentation, where the likely mistake is different: not an import, but a
   * link in prose or a `source.config.ts` still pointing at the other
   * application's directory.
   */
  it('reads its collection from its own directory', () => {
    const config = withoutComments(join(appRoot, 'source.config.ts'))

    expect(config).toMatch(/dir:\s*['"]content\/docs['"]/)
    expect(config).not.toMatch(/apps\/docs/)
  })

  it('is the only copy, now that the legacy application is gone', () => {
    // Stage 16 copied rather than moved, because the Next.js application still
    // had to build while that stage was in review. Stage 17 deleted it, and this
    // is the assertion that replaced the one saying so: a second copy of the
    // documentation is how the two drift, and the deleted one is where every
    // stale "the docs live in apps/docs" link used to point.
    expect(existsSync(join(repoRoot, 'apps/docs'))).toBe(false)
  })
})

/**
 * Where "View source" sends a contributor.
 *
 * The Next.js page built this URL inline from `apps/docs/content/docs`. After
 * Stage 17 that directory does not exist, so every documentation page would have
 * carried a link to a deleted file - a 404 for exactly the reader most likely to
 * want to fix something.
 */
describe('the GitHub source link', () => {
  it('points at this application content', () => {
    expect(DOCS_SOURCE_DIRECTORY).toBe('apps/web/content/docs')
    expect(docsGithubUrl('dev/plugins/create.mdx')).toBe(
      'https://github.com/aXenDeveloper/vitnode/blob/canary/apps/web/content/docs/dev/plugins/create.mdx',
    )
  })

  it('names the file the collection actually holds', () => {
    // `page.path` is the collection-relative path, which is why the URL is a
    // join and not a slug reconstruction.
    expect(contentFiles).toContain('dev/plugins/create.mdx')
  })

  it('is never built pointing at the Stage 17 deletion target', () => {
    const runtime = filesUnder(appSrc).filter(
      (path) => /\.tsx?$/.test(path) && !path.includes(`${sep}tests${sep}`),
    )
    const offenders = runtime
      .filter((path) => withoutComments(path).includes('apps/docs/content'))
      .map((path) => relative(appSrc, path))

    expect(offenders).toEqual([])
  })

  /**
   * And neither does the documentation itself. Several documents tell a
   * contributor where the docs live; after this stage that answer changed.
   */
  it('is not what the documentation tells contributors either', () => {
    const offenders = filesUnder(contentRoot)
      .filter((path) => /\.mdx?$/.test(path))
      .filter((path) =>
        readFileSync(path, 'utf8').includes('apps/docs/content'),
      )
      .map((path) => relative(contentRoot, path))

    expect(offenders).toEqual([])
  })
})

/**
 * Every internal documentation link resolves to a page that exists.
 *
 * Cheap to check and impossible to notice by reading: a `/docs/…` href in one
 * document names a file in another, and nothing about renaming or moving a page
 * tells you who was pointing at it. Fumadocs will happily render the link and
 * the router will happily 404 it.
 *
 * Four were already broken when the documentation was copied across -
 * `/docs/guides/captcha/cloudflare` (the captcha pages live under `dev`),
 * `/docs/dev/content-engine/scheduling` (never written), and `/docs/dev/plugins`
 * (a folder with no index page). This is what stops the next four.
 *
 * Anchors are deliberately not checked. A `#heading-id` is generated from the
 * heading text by a slugger, and reimplementing that here would be a second
 * slugger to keep in step with Fumadocs'.
 */
describe('internal documentation links', () => {
  /** A file's URL, by the same rule the loader derives one: `index` is the folder. */
  const urlOf = (file: string): string => {
    const parts = file.replace(/\.mdx?$/, '').split('/')

    if (parts.at(-1) === 'index') parts.pop()

    return ['/docs', ...parts].join('/')
  }

  const pages = new Set(
    contentFiles.filter((path) => /\.mdx?$/.test(path)).map(urlOf),
  )

  const linksIn = (file: string): string[] => {
    const source = readFileSync(join(contentRoot, file), 'utf8')

    return [
      ...source.matchAll(/\]\((\/docs[^)\s]*)\)/g),
      ...source.matchAll(/href="(\/docs[^"]*)"/g),
    ].map((match) => match[1].split('#')[0].replace(/\/$/, ''))
  }

  const documents = contentFiles.filter((path) => /\.mdx?$/.test(path))

  it('finds links to check', () => {
    expect(documents.flatMap(linksIn).length).toBeGreaterThan(100)
  })

  it.each(documents)('%s links only to pages that exist', (file) => {
    expect(linksIn(file).filter((url) => !pages.has(url))).toEqual([])
  })
})

/**
 * The source loader's contract, which the rest of the documentation is built on.
 *
 * `baseUrl` in particular: it is the *internal* path, and putting a locale in it
 * would produce a page tree whose every URL was wrong for one of the two
 * languages this site serves.
 */
describe('the source loader', () => {
  const loader = withoutComments(join(appSrc, 'docs/source.server.ts'))

  it('serves the documentation from /docs', () => {
    expect(loader).toMatch(/baseUrl:\s*['"]\/docs['"]/)
  })

  it('keeps the Lucide navigation icons', () => {
    expect(loader).toContain('lucideIconsPlugin()')
    expect(loader).toContain('icons')
  })

  it('keeps the processed Markdown that /llms-full.txt is made of', () => {
    const config = withoutComments(join(appRoot, 'source.config.ts'))

    expect(config).toContain('includeProcessedMarkdown: true')
    expect(loader).toContain("getText('processed')")
  })

  it('is server-only, and says so in a way the bundler enforces', () => {
    // `collections/server` eagerly loads the frontmatter of every document and
    // reaches the whole Lucide icon set. The marker at the top of the module is
    // what turns "somebody imported this from a component" into a build error
    // rather than a browser bundle nobody measured.
    expect(loader).toContain("import '@tanstack/react-start/server-only'")
  })

  it('is imported by nothing that renders', () => {
    // Every reader of the loader goes through a server function or a server
    // route. A component importing it would compile and then ship the content
    // index to every reader.
    const allowed = new Set([
      join('docs', 'transport.ts'),
      join('routes', 'docs.search.ts'),
      join('routes', 'llms-full[.]txt.ts'),
    ])

    const offenders = filesUnder(appSrc)
      .filter(
        (path) => /\.tsx?$/.test(path) && !path.includes(`${sep}tests${sep}`),
      )
      .filter((path) =>
        /['"][^'"]*docs\/source\.server['"]/.test(withoutComments(path)),
      )
      .map((path) => relative(appSrc, path))
      .filter((path) => !allowed.has(path))

    expect(offenders).toEqual([])
  })
})

/**
 * The new Development > TanStack Start section.
 *
 * Asserted as *structure* rather than as prose: that the category exists, that
 * every page the stage promised is there, and that the section is listed where a
 * reader will find it. What the pages say is reviewed by people.
 */
describe('the TanStack Start documentation category', () => {
  const category = join(contentRoot, 'dev/tanstack')

  it('exists with its own meta.json', () => {
    expect(existsSync(join(category, 'meta.json'))).toBe(true)
  })

  it('is listed in the Development section, near the top of Framework', () => {
    const meta = JSON.parse(
      readFileSync(join(contentRoot, 'dev/meta.json'), 'utf8'),
    ) as { pages: string[] }

    expect(meta.pages).toContain('tanstack')
    expect(meta.pages.indexOf('tanstack')).toBe(
      meta.pages.indexOf('---Framework---') + 1,
    )
  })

  it('has a page for each thing a plugin author has to know', () => {
    const meta = JSON.parse(
      readFileSync(join(category, 'meta.json'), 'utf8'),
    ) as { pages: string[]; title: string }

    expect(meta.title).toBe('TanStack Start')
    expect(meta.pages).toEqual([
      'index',
      'plugin',
      'routing',
      'metadata',
      'data-loading',
      'navigation',
      'i18n',
      'server-functions',
      'admin',
    ])

    for (const page of meta.pages) {
      expect(existsSync(join(category, `${page}.mdx`)), page).toBe(true)
    }
  })

  /**
   * Short, which was the explicit brief.
   *
   * A word count rather than a byte count, and generous rather than tight: the
   * point is that this category stays a *guide*. The deep reference pages next
   * to it run to 25 kB, and a second copy of one of those here would be worse
   * than not writing it at all.
   */
  it('keeps every page a guide rather than a reference manual', () => {
    for (const path of filesUnder(category)) {
      if (!path.endsWith('.mdx')) continue

      const prose = readFileSync(path, 'utf8')
        .replace(/^---[\s\S]*?\n---/, '')
        .replace(/```[\s\S]*?```/g, '')
        .trim()

      expect(prose.split(/\s+/).length, relative(category, path)).toBeLessThan(
        900,
      )
    }
  })

  it('teaches the current runtime, not the one being replaced', () => {
    for (const path of filesUnder(category)) {
      if (!path.endsWith('.mdx')) continue

      const source = readFileSync(path, 'utf8')
      const name = relative(category, path)

      // The four APIs a page in this category would be wrong to recommend.
      expect(source, name).not.toContain('generateMetadata')
      expect(source, name).not.toContain('next/navigation')
      expect(source, name).not.toContain('next-intl/navigation')
      expect(source, name).not.toContain('next/cache')
    }
  })

  /**
   * The public plugin route context is `{ locale }` and nothing else.
   *
   * An example that read `context.queryClient` inside a `definePluginRoute`
   * would compile in a reader's editor - the type is theirs to widen - and
   * arrive `undefined` at runtime. The contract is
   * `packages/vitnode/src/routing/module.ts`, which says so in those words.
   *
   * Scoped to what follows a `definePluginRoute`, because the same expression is
   * *correct* for an app-owned route: that one really does get the host's
   * `QueryClient` on its router context, and `data-loading.mdx` shows it.
   */
  it('never promises a plugin route more context than it gets', () => {
    for (const path of filesUnder(category)) {
      if (!path.endsWith('.mdx')) continue

      const source = readFileSync(path, 'utf8')
      const blocks = source.split('definePluginRoute').slice(1)

      for (const block of blocks) {
        expect(block.slice(0, 600), relative(category, path)).not.toMatch(
          /context\.queryClient/,
        )
      }
    }
  })

  /**
   * And the same claim from the other side: the category says out loud what a
   * plugin loader is handed, so a reader does not have to infer it from an
   * example that happens not to use anything else.
   */
  it('says what a plugin loader is handed', () => {
    const routing = readFileSync(join(category, 'routing.mdx'), 'utf8')

    expect(routing).toMatch(/`context` is `\{ locale \}`/)
    expect(routing).toContain('holds no')
    expect(routing).toContain('QueryClient')
  })
})
