/**
 * Where a documentation page's source actually lives, so a reader can edit it.
 *
 * `apps/web/content/docs` and not `apps/docs/content/docs`. Stage 16 moved the
 * ownership of the documentation into this application; the Next.js copy is
 * still on disk only until Stage 17 deletes it, and a "View source" link
 * pointing at a file scheduled for deletion is a link that will 404 for every
 * contributor who follows it after that stage lands.
 *
 * Pure, and separate from the component that renders the link, because it is
 * the one thing in the View Options menu worth asserting - see
 * `src/tests/docs-source.test.ts`.
 *
 * `page.path` is the path inside the collection (`dev/plugins/create.mdx`),
 * which is exactly the tail of the repository path.
 */
export const DOCS_SOURCE_DIRECTORY = 'apps/web/content/docs'

const REPOSITORY_BLOB_URL =
  'https://github.com/aXenDeveloper/vitnode/blob/canary'

export const docsGithubUrl = (pagePath: string): string =>
  `${REPOSITORY_BLOB_URL}/${DOCS_SOURCE_DIRECTORY}/${pagePath}`
