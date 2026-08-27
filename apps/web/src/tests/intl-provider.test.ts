import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = readFileSync(join(appSrc, 'routes/__root.tsx'), 'utf8')

/**
 * The bug this file exists to prevent coming back.
 *
 * `@vitnode/core` is external to the Vite SSR pass, so it is loaded by Node,
 * and the `use-intl` it reaches through `next-intl` is a different module
 * record - a different React context - from the one this app's source imports.
 * Every `useTranslations` in the shared design system looks for that other one.
 *
 * Providing only one of the two is a 500 on the first render of any core
 * component, and - this is the part worth pinning - **only under `vite dev`**.
 * A production build merges both records into a single chunk, so the built
 * server, the SSR tests and CI were all green while `pnpm dev` was broken.
 * Nothing that runs in this suite can reproduce that, because Vitest resolves
 * both through Node and gets one record. So the guard is on the source.
 */
describe('the root provides every intl context core might read', () => {
  it("mounts use-intl's provider, which this app's own code reads", () => {
    expect(root).toMatch(/import \{ IntlProvider \} from 'use-intl'/)
    expect(root).toContain('<IntlProvider {...intlProps}>')
  })

  it("mounts next-intl's record too, which every core component reads", () => {
    // Deleting this line turns `pnpm dev` into a 500 and leaves every other
    // check in this repository green. See the note in `__root.tsx`.
    expect(root).toMatch(
      /import \{ IntlProvider as NextIntlProvider \} from 'next-intl'/,
    )
    expect(root).toContain('<NextIntlProvider {...intlProps}>')
  })

  it('gives both the identical locale, messages and time zone', () => {
    // Spread from one object rather than written twice: two providers that
    // disagree would render half the page in the wrong language.
    expect(root).toMatch(/const intlProps = \{/)
    expect(root.match(/\{\.\.\.intlProps\}/g)).toHaveLength(2)
  })
})
