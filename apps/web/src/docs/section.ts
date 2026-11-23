export const docsSectionOf = (pathname: string): string | undefined => {
  const [, docs, section] = pathname.split('/')

  return docs === 'docs' && section ? section : undefined
}

const DOCS_SECTION_OG_COLORS: Readonly<Record<string, string>> = {
  brand: '#f2798f',
  'content-engine': '#61bd67',
  dev: '#ff8a3f',
  guides: '#5c8af0',
  ui: '#04b991',
}

export const docsSectionOgCategory = (
  section: null | undefined | { id: string; title: string },
) =>
  section
    ? { color: DOCS_SECTION_OG_COLORS[section.id], title: section.title }
    : undefined
