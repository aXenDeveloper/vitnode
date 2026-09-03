export const DOCS_SOURCE_DIRECTORY = 'apps/web/content/docs'

const REPOSITORY_BLOB_URL =
  'https://github.com/aXenDeveloper/vitnode/blob/canary'

export const docsGithubUrl = (pagePath: string): string =>
  `${REPOSITORY_BLOB_URL}/${DOCS_SOURCE_DIRECTORY}/${pagePath}`
