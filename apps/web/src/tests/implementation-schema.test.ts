import { frontmatter } from 'fumadocs-core/content/md/frontmatter'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it } from 'node:test'

import { docsPageSchema } from '../docs/implementation/schema.ts'

const docsDir = resolve(import.meta.dirname, '../../content/docs')

const implementation = {
  decisions: ['Which plugin owns the replies?'],
  objective: 'Add threaded replies under an existing content type.',
}

describe('docsPageSchema', () => {
  it('accepts a page without implementation metadata', () => {
    assert.ok(docsPageSchema.safeParse({ title: 'Plain page' }).success)
  })

  const invalid: [string, unknown][] = [
    ['an unknown key', { ...implementation, steps: ['Do it'] }],
    ['an empty decisions list', { ...implementation, decisions: [] }],
    [
      'a related link outside /docs',
      {
        ...implementation,
        related: [{ href: 'https://example.com/docs/x', title: 'X' }],
      },
    ],
  ]

  for (const [name, value] of invalid) {
    it(`rejects ${name}`, () => {
      assert.ok(
        !docsPageSchema.safeParse({ implementation: value, title: 'Guide' })
          .success,
      )
    })
  }
})

describe('guide implementation metadata', () => {
  const guides = readdirSync(docsDir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.mdx'))
    .map((path) => ({
      data: frontmatter(readFileSync(join(docsDir, path), 'utf8')).data,
      path,
    }))
    .filter(
      ({ data }) =>
        typeof data === 'object' && data !== null && 'implementation' in data,
    )

  it('is declared on several guides', () => {
    assert.ok(guides.length >= 3, `found ${guides.length}`)
  })

  for (const { data, path } of guides) {
    it(`${path} is valid and links only to existing docs pages`, () => {
      const page = docsPageSchema.parse(data)

      assert.ok(page.implementation, 'implementation frontmatter is missing')
      for (const { href } of page.implementation.related ?? []) {
        const slug = href.replace(/^\/docs\//, '').replace(/#.*$/, '')

        assert.ok(
          existsSync(join(docsDir, `${slug}.mdx`)) ||
            existsSync(join(docsDir, slug, 'index.mdx')),
          `${href} has no matching .mdx page`,
        )
      }
    })
  }
})
