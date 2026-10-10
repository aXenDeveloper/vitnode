import { globSync } from 'node:fs'
import { join } from 'node:path'

const DOCS_ROUTE = '/docs'
const DOCS_CONTENT_DIRECTORY = join(import.meta.dirname, '../../content/docs')

const docsPathFromFile = (file: string): string => {
  const slugs = file
    .replace(/\.mdx$/, '')
    .split(/[\\/]/)
    .filter((segment) => !/^\(.+\)$/.test(segment))

  if (slugs.at(-1) === 'index') slugs.pop()

  return [DOCS_ROUTE, ...slugs].join('/')
}

export const docsPrerenderPaths = (): string[] =>
  globSync('**/*.mdx', { cwd: DOCS_CONTENT_DIRECTORY })
    .map(docsPathFromFile)
    .filter((path) => path !== DOCS_ROUTE)
