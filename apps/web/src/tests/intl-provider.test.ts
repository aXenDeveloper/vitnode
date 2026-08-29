import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path: string) => readFileSync(join(appSrc, path), 'utf8')

const root = read('routes/__root.tsx')
const routeMessages = read('components/route-messages.tsx')

/**
 * The bug this file exists to prevent coming back.
 *
 * `@vitnode/core` is external to the Vite SSR pass, so it is loaded by Node,
 * which resolves `use-intl` to its `default` (production) build; this app's
 * source goes through Vite's module runner, which resolves the very same
 * package to its `development` build. Two files, two `createContext` calls, two
 * React contexts - and every `useTranslations` in the shared design system
 * looks for core's one.
 *
 * Providing only one of the two is a 500 on the first render of any core
 * component, and - this is the part worth pinning - **only under `vite dev`**.
 * A production build merges both records into a single chunk, so the built
 * server, the SSR tests and CI were all green while `pnpm dev` was broken.
 * Nothing that runs in this suite can reproduce that, because Vitest resolves
 * both through Node and gets one record. So the guard is on the source.
 *
 * Two places have to mount the pair, for two different scopes:
 *
 *     __root          -> core.global, above every route
 *     RouteMessages   -> one route's own namespaces, over the root's
 *
 * A provider mounted in only one of them is the subtler half of the same bug:
 * the shell renders in the right language and the page below it silently falls
 * back to the root's messages, which hold none of the route's strings.
 */
describe.each([
  { name: '__root', source: root },
  { name: 'RouteMessages', source: routeMessages },
])('$name provides every intl context core might read', ({ source }) => {
  it("mounts use-intl's provider, which this app's own code reads", () => {
    expect(source).toMatch(
      /import \{ IntlProvider(?: as \w+)? \} from 'use-intl'/,
    )
    expect(source).toContain('<IntlProvider {...intlProps}>')
  })

  it("mounts core's own record too, which every shared component reads", () => {
    // Deleting this line turns `pnpm dev` into a 500 and leaves every other
    // check in this repository green. See the note in `__root.tsx`.
    //
    // It is imported from `@vitnode/core/lib/i18n/provider` rather than from
    // `next-intl`: that module is loaded by whatever loaded the package, so it
    // *is* the record core's components read, rather than one that happens to
    // resolve the same way.
    expect(source).toMatch(
      /import \{ IntlProvider as CoreIntlProvider \} from '@vitnode\/core\/lib\/i18n\/provider'/,
    )
    expect(source).toContain('<CoreIntlProvider {...intlProps}>')
  })

  it('gives both the identical locale, messages and time zone', () => {
    // Spread from one object rather than written twice: two providers that
    // disagree would render half the page in the wrong language.
    expect(source).toMatch(/const intlProps = \{/)
    expect(source.match(/\{\.\.\.intlProps\}/g)).toHaveLength(2)
  })

  it('takes the locale from the router rather than from a second source', () => {
    // `useLocale` is subscribed to the router's location, which is what makes a
    // language switch re-render the provider - and what keeps the two providers
    // from ever being handed different answers.
    expect(source).toMatch(/const locale = useLocale\(\)/)
  })
})
