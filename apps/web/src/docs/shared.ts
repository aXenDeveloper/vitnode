export const DOCS_ROUTE = '/docs'
export const DOCS_SEARCH_PATH = `${DOCS_ROUTE}/search`
export const DOCS_STALE_TIME = import.meta.env.PROD ? Infinity : 0

const DOCS_SOURCE_DIRECTORY = 'apps/web/content/docs'
const REPOSITORY_BLOB_URL =
  'https://github.com/aXenDeveloper/vitnode/blob/canary'

export const docsGithubUrl = (pagePath: string): string =>
  `${REPOSITORY_BLOB_URL}/${DOCS_SOURCE_DIRECTORY}/${pagePath}`

export const encodeMarkdownUrl = (slugs: readonly string[]): string => {
  const last = slugs.at(-1)
  const segments =
    last === undefined ? ['index.md'] : [...slugs.slice(0, -1), `${last}.md`]

  return [DOCS_ROUTE, ...segments].join('/')
}

export const decodeMarkdownUrl = (segments: readonly string[]): string[] => {
  const last = segments.at(-1)

  if (last === undefined) return []

  const slugs = [...segments.slice(0, -1), last.replace(/\.md$/, '')]

  return slugs.length === 1 && slugs[0] === 'index' ? [] : slugs
}
