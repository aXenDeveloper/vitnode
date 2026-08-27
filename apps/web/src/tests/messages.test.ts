import { CONFIG_PLUGIN as CORE } from '@vitnode/core/config'
import { resetMessagesCache } from '@vitnode/core/lib/i18n/load-messages'
import { beforeEach, describe, expect, it } from 'vitest'

import { packageMessages } from '#/locales/packages'
import { loadIntlMessages } from '#/server/messages.server'
import { vitNodeConfig } from '#/vitnode.config'

beforeEach(() => {
  resetMessagesCache()
})

/**
 * The failure mode this whole file exists for: a message loader that cannot be
 * resolved does not throw. `loadMessages` warns once and returns an empty tree,
 * and the page renders `core.global.close` where it meant to say "Close" - in
 * production, on a page nobody re-read after the build.
 */
describe('every registered package has a loader this app can follow', () => {
  it('covers core and every plugin in the config', () => {
    const registered = [
      CORE.pluginId,
      ...vitNodeConfig.plugins.map((plugin) => plugin.pluginId),
    ]

    // `src/locales/packages.ts` is the one place these are declared, because
    // each package's own barrel cannot be bundled - see the note in that file.
    expect(Object.keys(packageMessages).sort()).toEqual(registered.sort())
  })

  it('resolves each of them to real messages', async () => {
    for (const [pluginId, locales] of Object.entries(packageMessages)) {
      for (const [locale, load] of Object.entries(locales)) {
        const loaded = await load()

        expect(
          Object.keys(loaded.default ?? {}),
          `${pluginId} ships ${locale}`,
        ).not.toEqual([])
      }
    }
  })
})

describe('loading one language for one set of namespaces', () => {
  it('returns the requested locale, not the default one', async () => {
    const { locale } = await loadIntlMessages({
      locale: 'pl',
      namespaces: ['core.global'],
    })

    expect(locale).toBe('pl')
  })

  it.each([
    ['en', 'Close'],
    ['pl', 'Zamknij'],
  ])('renders core.global.close in %s as "%s"', async (locale, expected) => {
    const { messages } = await loadIntlMessages({
      locale,
      namespaces: ['core.global'],
    })

    expect(messages).toHaveProperty('core.global.close', expected)
  })

  it('falls back to the default locale key by key', async () => {
    // Polish translates five strings. Everything else has to keep rendering
    // English rather than degrading to `core.global.loading`.
    const { messages } = await loadIntlMessages({
      locale: 'pl',
      namespaces: ['core.global'],
    })

    expect(messages).toHaveProperty('core.global.save', 'Zapisz')
    expect(messages).toHaveProperty('core.global.loading', 'Loading...')
  })

  it('merges app overrides on top of what the package ships', async () => {
    const en = await loadIntlMessages({
      locale: 'en',
      namespaces: ['core.global'],
    })

    // The app only overrides Polish, so English stays exactly the package's.
    expect(en.messages).toHaveProperty('core.global.close', 'Close')
  })

  it('ships only the namespaces that were asked for', async () => {
    const { messages } = await loadIntlMessages({
      locale: 'en',
      namespaces: ['core.global'],
    })
    const core = (messages as { core: Record<string, unknown> }).core

    // The merged tree holds every plugin's AdminCP copy. A page that renders
    // none of it should not ship it.
    expect(Object.keys(messages)).toEqual(['core'])
    expect(Object.keys(core)).toEqual(['global'])
  })

  it('can be asked for more than one namespace at a time', async () => {
    // What a real page will do from Stage 4 on: its own namespace plus the
    // global one, in a single request.
    const { messages } = await loadIntlMessages({
      locale: 'en',
      namespaces: ['core.global', 'core.search'],
    })
    const core = (messages as { core: Record<string, unknown> }).core

    expect(Object.keys(core).sort()).toEqual(['global', 'search'])
  })

  it('skips a namespace nothing provides rather than failing', async () => {
    const { messages } = await loadIntlMessages({
      locale: 'en',
      namespaces: ['core.global', 'nothing.here'],
    })

    expect(Object.keys(messages)).toEqual(['core'])
  })
})
