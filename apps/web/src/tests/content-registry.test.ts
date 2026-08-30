import { buildContentFrontendRegistry } from '@vitnode/core/content'
import { describe, expect, it } from 'vitest'

import { pluginContentTypes } from '#/content-registry.gen'
import { contentRegistry } from '#/lib/content-registry'

/**
 * The Content Engine registry this installation actually builds, from the
 * plugins it actually configures.
 *
 * `packages/vitnode` tests the registry's *rules* against synthetic content
 * types - ordering, duplicate detection, the two lookups. What only this app can
 * answer is whether the generated projection reaches the real thing: that
 * `@vitnode/blog`'s Tiptap field, colour field, colour cell and article layout
 * survive the trip through `admin/content` and a literal import, and arrive as
 * the same function references the plugin declared.
 *
 * That is the whole risk of the design. Serialising a registration would have
 * lost the components silently - a form with a plain textarea where the editor
 * should be, and no error anywhere - so the assertions below are about identity,
 * not shape.
 *
 * No rendering. Whether the editor draws correctly is a question for a browser;
 * whether it is *registered* is a question about references, and answering it by
 * mounting React would make it a question about jsdom.
 */

const entry = (id: string) => contentRegistry.byId(id)

describe('the generated registry reaches the configured plugins', () => {
  it('registers every content type both plugins declare', () => {
    expect(contentRegistry.all().map((item) => item.definition.id)).toEqual([
      'blog.category',
      'blog.post',
      'example.article',
      'example.category',
    ])
  })

  it('keeps each content type with the plugin that registered it', () => {
    expect(entry('blog.post')?.pluginId).toBe('@vitnode/blog')
    expect(entry('example.article')?.pluginId).toBe('@vitnode/example')
  })

  /**
   * The generated file is the only way in. A plugin dropped from
   * `vitnode.config.ts` disappears from it, and therefore from here - there is
   * no second list, and no `node_modules` scan that could put it back.
   */
  it('is built from the generated projection and nothing else', () => {
    expect(pluginContentTypes.map((source) => source.pluginId)).toEqual([
      '@vitnode/blog',
      '@vitnode/example',
    ])

    const fromGenerated = buildContentFrontendRegistry(pluginContentTypes)

    expect(fromGenerated.all().map((item) => item.definition.id)).toEqual(
      contentRegistry.all().map((item) => item.definition.id),
    )
  })

  it('drops a content type whose plugin is no longer configured', () => {
    const withoutBlog = buildContentFrontendRegistry(
      pluginContentTypes.filter(
        (source) => source.pluginId !== '@vitnode/blog',
      ),
    )

    expect(withoutBlog.byId('blog.post')).toBeUndefined()
    expect(withoutBlog.all().map((item) => item.definition.id)).toEqual([
      'example.article',
      'example.category',
    ])
  })
})

describe('lookups over the real content types', () => {
  it('finds one by id', () => {
    expect(entry('blog.post')?.definition.id).toBe('blog.post')
  })

  it('finds one by its AdminCP path', () => {
    const adminPath = entry('blog.post')?.definition.admin.path

    expect(adminPath).toBeDefined()
    expect(contentRegistry.byAdminPath(adminPath ?? '')?.definition.id).toBe(
      'blog.post',
    )
  })

  /**
   * The predicate the route resolver takes, answering with a definition rather
   * than an entry. Keyed by `admin.path`, which is the whole reason it exists:
   * a content type is free to be addressed by a name its id does not spell.
   */
  it('exposes a lookup keyed by admin path', () => {
    const definition = entry('blog.post')?.definition

    expect(definition).toBeDefined()
    expect(contentRegistry.lookup(definition?.admin.path ?? '')).toBe(
      definition,
    )
    expect(contentRegistry.lookup('blog/nothing-here')).toBeUndefined()
  })

  it('answers undefined rather than throwing for an unknown content type', () => {
    expect(entry('blog.nope')).toBeUndefined()
    expect(contentRegistry.byAdminPath('nope/nope')).toBeUndefined()
  })
})

/**
 * The four overrides `@vitnode/blog` actually ships - one of every kind the
 * Content Engine supports. If the registration mechanism ever starts losing
 * components, this is where it shows.
 */
describe('the blog keeps its overrides', () => {
  it('carries the article editor field', () => {
    expect(
      entry('blog.post')?.registration.fields?.content?.component,
    ).toBeTypeOf('function')
  })

  it('carries the article form layout', () => {
    expect(entry('blog.post')?.registration.forms?.layout).toBeTypeOf(
      'function',
    )
  })

  it('carries the category colour field and colour cell', () => {
    const category = entry('blog.category')

    expect(category?.registration.fields?.color?.component).toBeTypeOf(
      'function',
    )
    expect(category?.registration.columns?.color?.cell).toBeTypeOf('function')
  })

  /**
   * One declaration, two doors: `config.tsx` spreads `admin/content`, so the
   * registration the Next.js AdminCP walks and the one this app imports are the
   * same objects. Asserted by identity against the module the generated file
   * names, because two structurally identical registrations declared twice is
   * exactly the drift this design exists to prevent.
   */
  it('registers the same objects the plugin module declares', async () => {
    const { adminContent } = await import('@vitnode/blog/admin/content')
    const declared = adminContent.contentTypes.find(
      (item) => item.definition.id === 'blog.post',
    )

    expect(entry('blog.post')?.registration).toBe(declared)
  })
})

/**
 * `@vitnode/example` overrides nothing, and that is a case worth pinning: the
 * generated screens have to work from a definition alone, so an absent
 * `fields`/`columns`/`forms` must stay absent rather than becoming an empty
 * object somebody later reads as "overridden with nothing".
 */
describe('a plugin with no overrides registers cleanly', () => {
  it('registers its content types with no override keys', () => {
    const registration = entry('example.article')?.registration

    expect(registration?.definition.id).toBe('example.article')
    expect(registration?.fields).toBeUndefined()
    expect(registration?.columns).toBeUndefined()
    expect(registration?.forms).toBeUndefined()
  })

  it('still carries the icon the sidebar draws', () => {
    expect(entry('example.article')?.registration.icon).toBeDefined()
  })
})
