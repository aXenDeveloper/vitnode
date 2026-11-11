import type { MarketingPageMeta } from '@/site/marketing/metadata'

export interface SolutionEntry {
  metaDescription: string
  name: string
  slug: string
}

const SOLUTION_CATALOG = {
  'gaming-guild': {
    metaDescription:
      'Build a guild or clan hub with VitNode: Discord sign-in, ranks as roles, live announcements, events as a plugin and a multilingual roster. Free and open source.',
    name: 'Gaming guild hub',
  },
  'help-center': {
    metaDescription:
      'Build a help center with VitNode: articles as content types, site-wide search, editor and reviewer roles, real-time updates and SSO. Free and open source.',
    name: 'Help center',
  },
  'membership-site': {
    metaDescription:
      'Build a membership site with VitNode: blog posts, tiers as roles, members-only content, social sign-in and real-time updates on your own domain. Open source.',
    name: 'Membership site',
  },
  'multilingual-magazine': {
    metaDescription:
      'Run a multilingual magazine with VitNode: per-field translations, editorial roles, scheduled publishing, hreflang, sitemaps and search in every language.',
    name: 'Multilingual magazine',
  },
  'open-source-hub': {
    metaDescription:
      'Build a home for your open-source project with VitNode: release notes, guides, contributor roles, Discord sign-in, real-time updates and agent-readable docs.',
    name: 'Open-source hub',
  },
} satisfies Record<string, Omit<SolutionEntry, 'slug'>>

export type SolutionSlug = keyof typeof SOLUTION_CATALOG

export const SOLUTION_SLUGS = Object.keys(SOLUTION_CATALOG) as SolutionSlug[]

const isSolutionSlug = (slug: string): slug is SolutionSlug =>
  Object.hasOwn(SOLUTION_CATALOG, slug)

export const solutionEntry = (slug: SolutionSlug): SolutionEntry => ({
  slug,
  ...SOLUTION_CATALOG[slug],
})

export const findSolutionEntry = (slug: string): SolutionEntry | undefined =>
  isSolutionSlug(slug) ? solutionEntry(slug) : undefined

export const solutionPath = (slug: string) => `/solutions/${slug}`

export const solutionPageMeta = (
  solution: SolutionEntry,
): MarketingPageMeta => ({
  breadcrumbs: [
    { name: 'Solutions', path: '/solutions' },
    { name: solution.name, path: solutionPath(solution.slug) },
  ],
  description: solution.metaDescription,
  path: solutionPath(solution.slug),
  title: `${solution.name} - Solutions`,
})
