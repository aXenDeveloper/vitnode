export const docsSectionOf = (pathname: string): string | undefined => {
  const [, docs, section] = pathname.split('/')

  return docs === 'docs' && section ? section : undefined
}
