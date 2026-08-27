import { formatPageTitle, titleTemplate } from '@vitnode/core/lib/metadata'
import { describe, expect, it } from 'vitest'

import { Route as RootRoute } from '#/routes/__root'
import { Route as IndexRoute } from '#/routes/index'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

type HeadTag = Record<string, string | undefined>

/**
 * A route's `head()` output, as plain tag objects.
 *
 * The context argument is `never` because nothing under test reads it: these
 * routes derive their head from the app's config, which is the property being
 * pinned. A route that starts reading `loaderData` will fail here loudly rather
 * than quietly asserting nothing.
 */
const headTags = async (route: {
  options: { head?: (ctx: never) => unknown }
}) => {
  const head = ((await route.options.head?.(undefined as never)) ?? {}) as {
    links?: HeadTag[]
    meta?: HeadTag[]
  }

  return { links: head.links ?? [], meta: head.meta ?? [] }
}

/**
 * The root document's metadata comes from the app's VitNode config, not from the
 * starter it replaced - which hardcoded `"TanStack Start Starter"` and
 * `lang="en"`.
 */
describe('root metadata', () => {
  it('takes its title from the VitNode config', async () => {
    const { meta } = await headTags(RootRoute)

    expect(meta.map((tag) => tag.title)).toContain(
      vitNodeShellConfig.metadata.title,
    )
  })

  it('carries no starter metadata', async () => {
    const { meta } = await headTags(RootRoute)

    expect(JSON.stringify(meta)).not.toContain('Starter')
  })

  it('declares the charset and the viewport', async () => {
    const { meta } = await headTags(RootRoute)

    expect(meta).toEqual(
      expect.arrayContaining([
        { charSet: 'utf-8' },
        { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      ]),
    )
  })

  it('links the app stylesheet', async () => {
    const { links } = await headTags(RootRoute)

    expect(links.some((link) => link.rel === 'stylesheet')).toBe(true)
  })
})

/**
 * The short-title rule, which is core's and is shared with Next.js: there it is
 * handed to `title.template`, here it is applied directly. Both produce the same
 * string, which is the point of `formatPageTitle` existing.
 */
describe('per-route titles follow the config short title', () => {
  it('renders "<page> - <shortTitle>"', () => {
    const { metadata } = vitNodeShellConfig

    expect(formatPageTitle(metadata, 'Stage 3')).toBe(
      `Stage 3 - ${metadata.shortTitle ?? metadata.title}`,
    )
    expect(titleTemplate(metadata)).toBe(
      `%s - ${metadata.shortTitle ?? metadata.title}`,
    )
  })

  it('is what the home route sets', async () => {
    const { meta } = await headTags(IndexRoute)

    expect(meta.map((tag) => tag.title)).toContain(
      formatPageTitle(vitNodeShellConfig.metadata, 'Stage 3'),
    )
  })
})

/**
 * The slice of the config the browser is allowed to see.
 *
 * `plugins` is the field that must not be here: a plugin registration carries
 * message loaders today and its AdminCP components tomorrow, and this module is
 * imported by the document shell, which renders in the browser too.
 */
describe('the shell config', () => {
  it('holds what the shell renders from', () => {
    expect(vitNodeShellConfig.metadata.title).toBeTruthy()
    expect(vitNodeShellConfig.i18n.defaultLocale).toBeTruthy()
    expect(vitNodeShellConfig.i18n.locales.length).toBeGreaterThan(0)
    expect(vitNodeShellConfig.theme).toBeDefined()
    expect(vitNodeShellConfig.debug).toBe(false)
  })

  it('holds no plugin registry', () => {
    expect(vitNodeShellConfig).not.toHaveProperty('plugins')
  })

  it('is serializable, because it crosses to the browser', () => {
    expect(() => JSON.stringify(vitNodeShellConfig)).not.toThrow()
    expect(JSON.parse(JSON.stringify(vitNodeShellConfig))).toEqual(
      vitNodeShellConfig,
    )
  })
})

/**
 * The full config, which the server reads. It is built by core's `buildConfig`
 * from the same slice, so the two cannot disagree about the app's name.
 */
describe('the full config', () => {
  it('extends the shell config with the plugin registry', async () => {
    const { vitNodeConfig } = await import('#/vitnode.config')

    expect(vitNodeConfig.metadata).toEqual(vitNodeShellConfig.metadata)
    expect(vitNodeConfig.i18n.defaultLocale).toBe(
      vitNodeShellConfig.i18n.defaultLocale,
    )
    expect(vitNodeConfig.plugins.map((plugin) => plugin.pluginId)).toEqual([
      '@vitnode/blog',
      '@vitnode/example',
    ])
  })

  it('gives every registered plugin its translations', async () => {
    const { vitNodeConfig } = await import('#/vitnode.config')

    for (const plugin of vitNodeConfig.plugins) {
      expect(
        Object.keys(plugin.messages ?? {}),
        `${plugin.pluginId} ships messages`,
      ).not.toEqual([])
    }
  })
})
